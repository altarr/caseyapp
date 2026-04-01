'use strict';
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const REGION = process.env.AWS_REGION || 'us-east-1';
const DATA_DIR = path.join(__dirname, '..', 'data', 'sessions');

function getS3() {
  return new S3Client({ region: REGION });
}

async function listS3Sessions(bucket) {
  const s3 = getS3();
  const manifests = [];

  const resp = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: 'sessions/',
    Delimiter: '/',
  }));

  const prefixes = (resp.CommonPrefixes || []).map(p => p.Prefix.replace('sessions/', '').replace(/\/$/, '')).filter(Boolean);

  for (const sessionId of prefixes) {
    // Check if already imported
    const existing = db.getSession(sessionId);
    if (existing) continue;

    // Try to read package-manifest.json
    try {
      const manifestResp = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `sessions/${sessionId}/package-manifest.json`,
      }));
      const manifest = JSON.parse(await manifestResp.Body.transformToString());
      manifests.push({ session_id: sessionId, ...manifest });
    } catch (_) {
      // No manifest — check for metadata.json at least
      try {
        const metaResp = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: `sessions/${sessionId}/metadata.json`,
        }));
        const meta = JSON.parse(await metaResp.Body.transformToString());
        manifests.push({
          session_id: sessionId,
          visitor_name: meta.visitor_name,
          has_manifest: false,
        });
      } catch (_) {}
    }
  }

  return manifests;
}

async function importSession(sessionId, bucket, eventId) {
  const s3 = getS3();
  const sessionDir = path.join(DATA_DIR, sessionId);
  fs.mkdirSync(path.join(sessionDir, 'screenshots'), { recursive: true });

  // Read metadata
  let metadata = {};
  try {
    const metaResp = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: `sessions/${sessionId}/metadata.json`,
    }));
    metadata = JSON.parse(await metaResp.Body.transformToString());
  } catch (_) {}

  // Read manifest
  let manifest = {};
  try {
    const manResp = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: `sessions/${sessionId}/package-manifest.json`,
    }));
    manifest = JSON.parse(await manResp.Body.transformToString());
  } catch (_) {}

  // Download and extract zip if it exists
  const zipKey = manifest.zip_key;
  if (zipKey) {
    try {
      const zipResp = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: zipKey,
      }));
      const chunks = [];
      for await (const chunk of zipResp.Body) chunks.push(chunk);
      const zipBuffer = Buffer.concat(chunks);

      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(sessionDir, true);
      console.log(`  [import] Extracted ${zipKey} to ${sessionDir}`);
    } catch (err) {
      console.error(`  [import] Zip download failed for ${sessionId}: ${err.message}`);
    }
  }

  // Count screenshots
  const screenshotsDir = path.join(sessionDir, 'screenshots');
  const screenshotCount = fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.jpg')).length : 0;

  // Download audio from S3 if it exists (phone uploads separately from zip)
  const audioFormats = ['recording.m4a', 'recording.wav', 'recording.mp3', 'recording.webm'];
  const audioDir = path.join(sessionDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  for (const af of audioFormats) {
    try {
      const audioResp = await s3.send(new GetObjectCommand({
        Bucket: bucket, Key: `sessions/${sessionId}/audio/${af}`,
      }));
      const chunks = [];
      for await (const chunk of audioResp.Body) chunks.push(chunk);
      fs.writeFileSync(path.join(audioDir, af), Buffer.concat(chunks));
      console.log(`  [import] Downloaded audio: ${af}`);
      break;
    } catch (_) {}
  }

  // Check for audio (any format)
  const hasAudio = audioFormats.some(af => fs.existsSync(path.join(audioDir, af)));

  // Save to DB
  const session = db.upsertSession({
    session_id: sessionId,
    event_id: eventId || null,
    visitor_name: metadata.visitor_name || manifest.visitor_name || 'Unknown',
    visitor_company: metadata.visitor_company || metadata.company || null,
    status: 'imported',
    zip_key: zipKey || null,
    screenshot_count: screenshotCount,
    has_audio: hasAudio,
    audio_opted_out: manifest.audio_opted_out || false,
    local_path: sessionDir,
  });

  console.log(`  [import] Session ${sessionId}: ${screenshotCount} screenshots, audio: ${hasAudio}`);
  return session;
}

async function importAll(bucket, eventId) {
  const available = await listS3Sessions(bucket);
  const results = { imported: 0, skipped: 0, errors: 0, sessions: [] };

  for (const item of available) {
    try {
      const session = await importSession(item.session_id, bucket, eventId);
      results.imported++;
      results.sessions.push(session);
    } catch (err) {
      console.error(`  [import] Error importing ${item.session_id}: ${err.message}`);
      results.errors++;
    }
  }

  console.log(`  [import] Done: ${results.imported} imported, ${results.skipped} skipped, ${results.errors} errors`);
  return results;
}

module.exports = { listS3Sessions, importSession, importAll };
