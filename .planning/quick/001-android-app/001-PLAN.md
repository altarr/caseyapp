# Android BoothApp - Badge Capture & Session Management

## Goal
Build an Android app (API 33+) that captures visitor badge photos via CameraX, extracts name/company via ML Kit OCR, creates sessions via the Lambda orchestrator, and uploads badge photos + metadata to S3.

## Success Criteria
- [ ] App builds and targets API 33+
- [ ] CameraX captures badge photos
- [ ] ML Kit OCR extracts visitor name and company from badge
- [ ] Creates session via Lambda orchestrator POST /sessions
- [ ] Uploads badge photo to S3 bucket boothapp-sessions-752266476357
- [ ] Start Session and End Session buttons functional
- [ ] TrendAI brand colors and styling applied
- [ ] AWS SDK used for S3 uploads
- [ ] App follows DATA-CONTRACT.md schema for metadata.json

## Approach
- Kotlin-based Android app with Jetpack Compose for UI
- CameraX for camera capture
- ML Kit Text Recognition for OCR
- AWS SDK for Android for S3 uploads
- Retrofit/OkHttp for Lambda orchestrator API calls
- Configurable orchestrator URL (Lambda Function URL)
