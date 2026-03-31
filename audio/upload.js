#!/usr/bin/env node
'use strict';

/**
 * upload.js — CLI entry point for uploading session audio to S3.
 *
 * Usage:
 *   node upload.js <session-id>
 *   SESSION_ID=<id> node upload.js
 *
 * Environment:
 *   S3_BUCKET   - S3 bucket name (required, or uses infra/config.js default)
 *   SESSION_ID  - Session ID (or pass as CLI arg)
 *   OUTPUT_DIR  - Local directory with recording.wav (default: ./output/<session_id>)
 *   AWS_REGION  - AWS region (default: us-east-1)
 */

const path = require('path');
const { uploadSessionAudio } = require('./lib/s3-upload');

let SESSION_BUCKET;
try {
  SESSION_BUCKET = require('../infra/config').SESSION_BUCKET;
} catch {
  SESSION_BUCKET = null;
}

async function main() {
  const sessionId = process.argv[2] || process.env.SESSION_ID;
  if (!sessionId) {
    console.error('Usage: node upload.js <session-id>');
    console.error('  Or set SESSION_ID env var.');
    process.exit(1);
  }

  const bucket = process.env.S3_BUCKET || SESSION_BUCKET;
  if (!bucket) {
    console.error('Error: S3_BUCKET env var is required (or infra/config.js must be available).');
    process.exit(1);
  }

  const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, 'output', sessionId);
  const region = process.env.AWS_REGION || 'us-east-1';

  console.log(`[upload] Session: ${sessionId}`);
  console.log(`[upload] Bucket:  ${bucket}`);
  console.log(`[upload] Source:  ${outputDir}`);

  try {
    const result = await uploadSessionAudio({ sessionId, outputDir, bucket, region });
    console.log('[upload] Done.');
    console.log(`  Audio:      s3://${bucket}/${result.audioKey}`);
    if (result.transcriptKey) {
      console.log(`  Transcript: s3://${bucket}/${result.transcriptKey}`);
    }
  } catch (err) {
    console.error(`[upload] Fatal: ${err.message}`);
    process.exit(1);
  }
}

main();
