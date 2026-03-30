# Audio Transcription Integration Test

## Goal
Build an end-to-end integration test that generates a WAV file, converts to MP3, uploads to S3, triggers AWS Transcribe, polls for completion, and validates the transcript JSON format.

## Success Criteria
1. `audio/transcriber/test-transcribe.js` exists and runs the full pipeline
2. Generates a short WAV file programmatically (tone generator)
3. Converts WAV to MP3 (ffmpeg or lame)
4. Uploads MP3 to S3 under a test session prefix
5. Triggers AWS Transcribe on the uploaded file
6. Polls for job completion
7. Validates transcript JSON has `results.transcripts[].transcript`
8. Cleans up test artifacts (S3 objects, Transcribe job)
9. `scripts/test-transcribe.sh` wrapper exists and runs the test
10. Uses `infra/config.js` for bucket name
