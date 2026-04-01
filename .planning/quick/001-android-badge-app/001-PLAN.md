# Android Badge Capture App

## Goal
Build an Android app that captures visitor badge photos via camera, runs OCR to extract visitor name and company, creates a session via the Lambda orchestrator, and uploads badge photo and metadata to S3.

## Success Criteria
- [x] Android app targets API 33+
- [x] CameraX for camera preview and badge photo capture
- [x] ML Kit OCR extracts visitor name and company from badge
- [x] Creates session via Lambda orchestrator POST /sessions
- [x] Uploads badge photo to S3 bucket boothapp-sessions-752266476357
- [x] Start Session and End Session buttons
- [x] TrendAI brand colors and dark theme
- [x] Settings screen for orchestrator URL, AWS credentials, defaults
- [x] Encrypted storage for AWS credentials

- [x] metadata.json uploaded to S3 on session start (from closed PR #210)
- [x] Round launcher icon configured (from closed PR #210)
- [x] Use Gson for metadata JSON serialization instead of string concatenation

## Status
PR #203 merged. Polish improvements applied in new PR.
