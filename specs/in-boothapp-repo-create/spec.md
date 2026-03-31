# E2E Pipeline Integration Test

## Problem
No automated way to verify the full boothapp pipeline works end-to-end:
session upload -> watcher detection -> Claude analysis -> output generation.

## Solution
Shell script at `scripts/test/test-e2e-pipeline.sh` that:
1. Generates realistic sample session (metadata, clicks, screenshots, transcript)
2. Uploads to S3 under a unique test session ID
3. Polls for watcher output (summary.json) with 120s timeout
4. Validates output: summary.json fields + HTML report
5. Cleans up test session from S3
6. Exits 0 on success, non-zero with descriptive error

## Success Criteria
- [x] Script generates valid session data matching DATA-CONTRACT.md schemas
- [x] Uploads all artifacts to S3 under `sessions/E2E-TEST-<timestamp>/`
- [x] Polls for `output/summary.json` with configurable timeout (default 120s)
- [x] Validates required fields: session_id, visitor_name, key_interests, follow_up_actions, executive_summary
- [x] Checks HTML report exists and contains `<html>` tag
- [x] Cleans up test data on exit (unless --no-cleanup)
- [x] Exit 0 on all-pass, exit 1 on any failure with descriptive message

## Environment
- AWS_PROFILE=hackathon
- S3_BUCKET=boothapp-sessions-752266476357
- AWS_REGION=us-east-1

## Status
Implemented and merged to main via PR #180.
