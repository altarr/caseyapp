# Implementation Plan: E2E Pipeline Test

## Approach
Single bash script using AWS CLI for S3 operations, python3 for JSON validation.

## Steps
1. Preflight: verify AWS credentials and bucket access
2. Generate test data: metadata.json, clicks.json, 3 placeholder JPEGs, transcript.json
3. Upload all files under `sessions/E2E-TEST-<ts>-<pid>/`
4. Poll loop: check for `output/summary.json` every 5s, timeout at 120s
5. Download and validate summary.json (valid JSON, required fields non-empty)
6. Check HTML report exists
7. Cleanup via EXIT trap (remove all S3 objects under test prefix)
8. Report pass/fail counts

## Dependencies
- AWS CLI with hackathon profile configured
- python3 (for JSON parsing)
- Running watcher: `node analysis/watcher.js`

## Status
Implemented and merged to main via PR #180.
