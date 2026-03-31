# Android Badge Capture App

## Goal
Build an Android app for the BoothApp trade show demo that captures visitor badge photos, runs OCR, creates sessions via Lambda orchestrator, and uploads to S3.

## Success Criteria
- [x] Android app in android/ directory targeting API 33+
- [x] CameraX camera preview and photo capture
- [x] ML Kit OCR extracts visitor name and company from badge photo
- [x] Creates session via Lambda orchestrator REST API
- [x] Uploads badge photo to S3 bucket boothapp-sessions-752266476357 in us-east-1
- [x] Start Session and End Session buttons
- [x] Trend Micro brand colors (#D40020 red, dark theme)
- [x] Settings screen for orchestrator URL, AWS credentials, demo PC defaults
- [x] Encrypted credential storage via EncryptedSharedPreferences
- [x] PR created and pushed to origin
