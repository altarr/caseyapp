# Android App Polish

## Goal
Improve the BoothApp Android app with metadata.json upload to S3 (per DATA-CONTRACT.md) and fix the round launcher icon reference.

## Success Criteria
- [ ] App uploads metadata.json to S3 alongside badge.jpg when starting a session
- [ ] metadata.json follows DATA-CONTRACT.md schema (session_id, visitor_name, started_at, demo_pc, status)
- [ ] Round launcher icon XML exists and manifest references it correctly
- [ ] No regressions in existing badge capture / OCR / session flow
