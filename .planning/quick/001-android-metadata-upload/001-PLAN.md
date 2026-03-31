# Android App: Metadata Upload & Icon Fix

## Goal
Complete the Android badge capture app by adding metadata.json upload to S3 on session start (per DATA-CONTRACT.md) and fix the launcher round icon reference.

## Success Criteria
- [x] S3Uploader has uploadMetadata() that writes metadata.json per DATA-CONTRACT.md schema
- [x] MainActivity calls uploadMetadata() alongside uploadBadgePhoto() on session start
- [x] AndroidManifest references ic_launcher_round correctly
- [x] ic_launcher_round.xml exists with adaptive-icon definition
