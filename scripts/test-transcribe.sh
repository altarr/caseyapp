#!/usr/bin/env bash
# Integration test wrapper for the audio transcription pipeline.
# Generates a WAV, uploads to S3, runs AWS Transcribe, validates output.
#
# Usage:
#   ./scripts/test-transcribe.sh
#
# Prerequisites:
#   - AWS credentials configured (profile "hackathon")
#   - Node.js >= 18
#   - npm dependencies installed in audio/transcriber/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TRANSCRIBER_DIR="$PROJECT_ROOT/audio/transcriber"

echo "=== Audio Transcription Integration Test ==="
echo "Bucket: $(node -e "console.log(require('$PROJECT_ROOT/infra/config').SESSION_BUCKET)")"
echo ""

# Install dependencies if needed
if [ ! -d "$TRANSCRIBER_DIR/node_modules" ]; then
  echo "Installing transcriber dependencies..."
  (cd "$TRANSCRIBER_DIR" && npm install --production)
  echo ""
fi

# Run the integration test
echo "Running integration test..."
echo ""
node "$TRANSCRIBER_DIR/test-transcribe.js"
