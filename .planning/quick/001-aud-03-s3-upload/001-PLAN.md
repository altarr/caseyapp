# Plan: aud-03-s3-upload

## Goal
Upload audio recording (WAV) and transcript (JSON) to S3 session folder after recording and transcription complete. Support multipart upload for large WAV files, retry on failure, and update session metadata.

## Success Criteria
1. `audio/lib/s3-upload.js` module with `uploadSessionAudio(sessionId)` function
2. Uploads `recording.wav` to `sessions/<id>/audio/recording.wav`
3. Uploads `transcript.json` to `sessions/<id>/transcript/transcript.json` (already done in transcriber/upload.js -- reuse or coordinate)
4. Multipart upload for WAV files over 100MB
5. Retry logic: 3 attempts with exponential backoff
6. Updates metadata.json `status` field to mark audio as uploaded
7. CLI entry point for standalone use
8. Unit tests with mocked S3 client

## Approach
- Create `audio/lib/s3-upload.js` with the upload logic using @aws-sdk/client-s3 and @aws-sdk/lib-storage (for multipart)
- Use infra/config.js for bucket/region constants
- Add CLI wrapper `audio/upload.js`
- Add test file `audio/test-upload.js`
- Wire into recorder.js post-stop hook
