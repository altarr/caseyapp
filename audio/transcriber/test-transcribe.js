'use strict';

/**
 * Integration test: Audio Transcription Pipeline
 *
 * 1. Generate a short WAV file (440Hz sine tone, 3 seconds)
 * 2. Upload WAV to S3 under a test session prefix
 * 3. Start AWS Transcribe job
 * 4. Poll for completion
 * 5. Validate transcript JSON has results.transcripts[].transcript
 * 6. Clean up (S3 objects + Transcribe job)
 *
 * Usage:
 *   node test-transcribe.js
 *
 * Requires:
 *   AWS credentials (profile "hackathon") with S3 + Transcribe permissions
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
} = require('@aws-sdk/client-transcribe');
const { SESSION_BUCKET, AWS_REGION, sessionKey } = require('../../infra/config');

const TEST_SESSION_ID = `test-transcribe-${Date.now()}`;
const AUDIO_KEY = sessionKey(TEST_SESSION_ID, 'audio', 'recording.wav');
const TRANSCRIPT_OUTPUT_KEY = sessionKey(TEST_SESSION_ID, 'transcript', '.transcribe-raw.json');

// ---------------------------------------------------------------------------
// WAV generation -- pure Node.js, no external dependencies
// ---------------------------------------------------------------------------

/**
 * Generate a PCM WAV buffer containing a sine tone.
 * @param {number} freqHz - Tone frequency (default 440)
 * @param {number} durationSec - Duration in seconds (default 3)
 * @param {number} sampleRate - Sample rate (default 16000 -- Transcribe-friendly)
 * @returns {Buffer}
 */
function generateWav(freqHz = 440, durationSec = 3, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * bytesPerSample;

  // 44-byte WAV header + PCM data
  const buf = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buf.write('RIFF', offset); offset += 4;
  buf.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buf.write('WAVE', offset); offset += 4;

  // fmt sub-chunk
  buf.write('fmt ', offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;           // sub-chunk size
  buf.writeUInt16LE(1, offset); offset += 2;             // PCM format
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // byte rate
  buf.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2;              // block align
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  buf.write('data', offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); offset += 4;

  // PCM samples -- sine wave
  const amplitude = 0.8 * 32767;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(amplitude * Math.sin(2 * Math.PI * freqHz * i / sampleRate));
    buf.writeInt16LE(sample, offset);
    offset += 2;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeJobName() {
  return `boothapp-inttest-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------

async function main() {
  const s3 = new S3Client({ region: AWS_REGION });
  const transcribe = new TranscribeClient({ region: AWS_REGION });
  const jobName = makeJobName();

  const cleanup = [];

  try {
    // ── Step 1: Generate WAV ──────────────────────────────────────────
    console.log('[test] Step 1: Generating 3-second 440Hz WAV (16kHz mono PCM)...');
    const wavBuffer = generateWav(440, 3, 16000);
    console.log(`[test]   WAV size: ${wavBuffer.length} bytes`);
    if (wavBuffer.length < 100) throw new Error('WAV buffer too small');

    // ── Step 2: Upload to S3 ──────────────────────────────────────────
    console.log(`[test] Step 2: Uploading to s3://${SESSION_BUCKET}/${AUDIO_KEY}`);
    await s3.send(new PutObjectCommand({
      Bucket: SESSION_BUCKET,
      Key: AUDIO_KEY,
      Body: wavBuffer,
      ContentType: 'audio/wav',
    }));
    cleanup.push(() => s3.send(new DeleteObjectCommand({ Bucket: SESSION_BUCKET, Key: AUDIO_KEY })));
    console.log('[test]   Upload complete.');

    // ── Step 3: Start Transcribe job ──────────────────────────────────
    console.log(`[test] Step 3: Starting Transcribe job: ${jobName}`);
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: 'en-US',
      MediaFormat: 'wav',
      Media: {
        MediaFileUri: `s3://${SESSION_BUCKET}/${AUDIO_KEY}`,
      },
      OutputBucketName: SESSION_BUCKET,
      OutputKey: TRANSCRIPT_OUTPUT_KEY,
    }));
    cleanup.push(() => transcribe.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName })));
    console.log('[test]   Job started.');

    // ── Step 4: Poll for completion ───────────────────────────────────
    console.log('[test] Step 4: Polling for completion (10s intervals, 5min timeout)...');
    const timeoutMs = 5 * 60 * 1000;
    const start = Date.now();

    let status = 'IN_PROGRESS';
    while (status === 'IN_PROGRESS' || status === 'QUEUED') {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Transcribe job timed out after 5 minutes');
      }
      await sleep(10000);
      const resp = await transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
      status = resp.TranscriptionJob.TranscriptionJobStatus;
      console.log(`[test]   Status: ${status} (${Math.round((Date.now() - start) / 1000)}s elapsed)`);

      if (status === 'FAILED') {
        throw new Error(`Transcribe job failed: ${resp.TranscriptionJob.FailureReason}`);
      }
    }

    if (status !== 'COMPLETED') {
      throw new Error(`Unexpected job status: ${status}`);
    }
    console.log('[test]   Job completed.');

    // ── Step 5: Fetch and validate transcript JSON ────────────────────
    console.log(`[test] Step 5: Fetching transcript from s3://${SESSION_BUCKET}/${TRANSCRIPT_OUTPUT_KEY}`);
    const getResp = await s3.send(new GetObjectCommand({ Bucket: SESSION_BUCKET, Key: TRANSCRIPT_OUTPUT_KEY }));
    cleanup.push(() => s3.send(new DeleteObjectCommand({ Bucket: SESSION_BUCKET, Key: TRANSCRIPT_OUTPUT_KEY })));

    const chunks = [];
    for await (const chunk of getResp.Body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    // Validate expected structure
    console.log('[test] Step 6: Validating transcript JSON structure...');

    if (!raw.results) {
      throw new Error('Missing "results" key in transcript JSON');
    }
    if (!Array.isArray(raw.results.transcripts)) {
      throw new Error('Missing "results.transcripts" array in transcript JSON');
    }
    if (raw.results.transcripts.length === 0) {
      throw new Error('"results.transcripts" array is empty');
    }

    const firstTranscript = raw.results.transcripts[0];
    if (typeof firstTranscript.transcript !== 'string') {
      throw new Error('"results.transcripts[0].transcript" is not a string');
    }

    console.log(`[test]   Transcript text: "${firstTranscript.transcript.slice(0, 200)}"`);
    console.log('[test]   Structure validated: results.transcripts[].transcript exists');

    // Also check items array exists (used by convert.js)
    if (!Array.isArray(raw.results.items)) {
      console.log('[test]   WARNING: results.items array missing (pure tone may not produce words)');
    } else {
      console.log(`[test]   results.items count: ${raw.results.items.length}`);
    }

    console.log('\n[test] *** ALL CHECKS PASSED ***');
  } catch (err) {
    console.error(`\n[test] *** FAILED: ${err.message} ***`);
    process.exitCode = 1;
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────
    console.log('[test] Cleaning up test artifacts...');
    for (const fn of cleanup) {
      try { await fn(); } catch (_) { /* best effort */ }
    }
    console.log('[test] Cleanup complete.');
  }
}

main();
