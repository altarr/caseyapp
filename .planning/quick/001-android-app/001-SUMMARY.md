# Summary: Android BoothApp

## What Was Done
Built complete Android app in `android/` directory for trade show badge capture and session management.

## Components
- **CameraManager** -- CameraX preview + JPEG capture with rotation correction
- **BadgeOcrProcessor** -- ML Kit OCR with conference badge heuristics (filters event names, badge codes, dates)
- **SessionApi** -- OkHttp REST client matching orchestrator's POST /sessions and POST /sessions/:id/end
- **S3Uploader** -- AWS SDK PutObject to `sessions/<id>/badge.jpg` per DATA-CONTRACT.md
- **AppPreferences** -- EncryptedSharedPreferences for AWS credentials
- **MainActivity** -- Full flow: capture -> OCR -> start session -> end session
- **SettingsActivity** -- Orchestrator URL, AWS creds, demo PC/SE defaults

## Design Decisions
- Used View Binding (not Compose) for faster iteration and simpler layout debugging
- EncryptedSharedPreferences for AWS creds with fallback to regular prefs if crypto fails
- Badge OCR uses font-size heuristic (largest text block = name, second = company)
- Adaptive vector icon (no bitmap mipmap needed since minSdk 33 > API 26)
- Network security config restricts cleartext to localhost/emulator only

## Verified
- File structure matches standard Android project layout
- API contract matches orchestrator.js (field names, endpoints, validation patterns)
- S3 key format matches DATA-CONTRACT.md (`sessions/<id>/badge.jpg`)
- Gradle config uses correct SDK versions and dependency coordinates

## PR
https://github.com/altarr/boothapp/pull/203
