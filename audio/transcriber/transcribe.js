'use strict';

const { StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique job name for a session.
 * Format: boothapp-<sessionId>-<timestamp>
 * Max 200 chars, only alphanumeric and hyphens.
 * @param {string} sessionId
 * @returns {string}
 */
function makeJobName(sessionId) {
  const timestamp = Date.now();
  const raw = `boothapp-${sessionId}-${timestamp}`;
  // Sanitize: replace any non-alphanumeric/hyphen chars with hyphen
  const sanitized = raw.replace(/[^a-zA-Z0-9-]/g, '-');
  return sanitized.slice(0, 200);
}

/**
 * Start an AWS Transcribe job.
 * @param {import('@aws-sdk/client-transcribe').TranscribeClient} transcribeClient
 * @param {{ bucket: string, sessionId: string, jobName: string }} params
 * @returns {Promise<string>} outputKey
 */
async function startTranscriptionJob(transcribeClient, { bucket, sessionId, jobName }) {
  const inputKey = `sessions/${sessionId}/audio/recording.wav`;
  const outputKey = `sessions/${sessionId}/transcript/.transcribe-raw.json`;

  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    MediaFormat: 'wav',
    Media: {
      MediaFileUri: `s3://${bucket}/${inputKey}`,
    },
    OutputBucketName: bucket,
    OutputKey: outputKey,
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 2,
    },
  });

  await transcribeClient.send(command);
  return outputKey;
}

/**
 * Poll until transcription job completes or fails.
 * Polls every 10 seconds, times out after 15 minutes.
 * @param {import('@aws-sdk/client-transcribe').TranscribeClient} transcribeClient
 * @param {string} jobName
 * @returns {Promise<object>} completed job
 */
async function waitForJob(transcribeClient, jobName) {
  const timeoutMs = 15 * 60 * 1000; // 15 minutes
  const pollIntervalMs = 10 * 1000; // 10 seconds
  const start = Date.now();

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed >= timeoutMs) {
      throw new Error(`Transcription job "${jobName}" timed out after 15 minutes`);
    }

    const command = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
    const response = await transcribeClient.send(command);
    const job = response.TranscriptionJob;
    const status = job.TranscriptionJobStatus;

    if (status === 'COMPLETED') {
      return job;
    }

    if (status === 'FAILED') {
      const reason = job.FailureReason || 'Unknown failure';
      throw new Error(`Transcription job "${jobName}" failed: ${reason}`);
    }

    // IN_PROGRESS or QUEUED — wait and retry
    await sleep(pollIntervalMs);
  }
}

/**
 * Read and parse the raw transcription JSON from S3.
 * @param {import('@aws-sdk/client-s3').S3Client} s3Client
 * @param {string} bucket
 * @param {string} outputKey
 * @returns {Promise<object>}
 */
async function getRawTranscript(s3Client, bucket, outputKey) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: outputKey });
  const response = await s3Client.send(command);

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(body);
}

/**
 * Delete the temporary S3 raw file and the transcription job.
 * Uses Promise.allSettled — errors are swallowed.
 * @param {import('@aws-sdk/client-s3').S3Client} s3Client
 * @param {import('@aws-sdk/client-transcribe').TranscribeClient} transcribeClient
 * @param {string} bucket
 * @param {string} outputKey
 * @param {string} jobName
 * @returns {Promise<void>}
 */
async function cleanupRaw(s3Client, transcribeClient, bucket, outputKey, jobName) {
  await Promise.allSettled([
    s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: outputKey })),
    transcribeClient.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName })),
  ]);
}

module.exports = {
  makeJobName,
  startTranscriptionJob,
  waitForJob,
  getRawTranscript,
  cleanupRaw,
  sleep,
};
