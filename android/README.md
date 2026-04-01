# BoothApp Android - Badge Capture & Session Management

Android app for trade show demo capture. Scans visitor badges via camera, extracts name/company with OCR, creates sessions via the Lambda orchestrator, and uploads badge photos to S3.

## Requirements

- Android Studio Hedgehog (2023.1) or later
- Android SDK 34
- Device running Android 13+ (API 33)

## Setup

1. Open `android/` in Android Studio
2. Configure settings in the app:
   - **Orchestrator URL**: Lambda Function URL for session-orchestrator
   - **AWS credentials**: Access key with PutObject permission on `boothapp-sessions-752266476357`
   - **Demo PC ID**: Identifier for the demo station (e.g. `booth-pc-1`)
   - **SE Name**: Sales engineer name

## Architecture

```
com.trendmicro.boothapp/
  ui/
    MainActivity.kt      -- Camera preview, badge capture, session controls
    SettingsActivity.kt   -- Orchestrator URL, AWS creds, defaults
  camera/
    CameraManager.kt     -- CameraX lifecycle and photo capture
  ocr/
    BadgeOcrProcessor.kt -- ML Kit text recognition with badge heuristics
  data/
    SessionApi.kt        -- Orchestrator REST client (create/end session)
    S3Uploader.kt        -- AWS SDK S3 upload for badge photos
    AppPreferences.kt    -- Encrypted preferences for credentials
```

## User Flow

1. Point camera at visitor badge, tap **Capture Badge**
2. OCR extracts name and company into text fields (editable)
3. Tap **Start Session** -- creates session via orchestrator, uploads badge to S3
4. Demo runs on the demo PC (Chrome extension captures clicks/screenshots)
5. Tap **End Session** -- signals orchestrator to stop recording

## Dependencies

- **CameraX** 1.3.1 -- camera preview and capture
- **ML Kit** 16.0.0 -- on-device text recognition
- **AWS SDK** 2.73.0 -- S3 PutObject for badge photos
- **OkHttp** 4.12.0 -- REST calls to session orchestrator
- **Material Components** 1.11.0 -- TrendAI branded UI
