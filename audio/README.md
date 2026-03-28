# Workstream B: Audio Capture & Transcription

## Owner Pool
CCC workers assigned to `audio/` only touch files in this directory.

## What This Does
Records audio from a wireless USB mic on the demo PC during booth demos.
Transcribes audio to text after session ends. Uploads to S3.

## Base
Adapted from meeting-recorder project (ffmpeg DirectShow capture).

## Outputs (to S3 session folder)
- `audio/recording.wav` — 44100Hz stereo WAV
- `transcript/transcript.json` — see DATA-CONTRACT.md for schema

## Inputs (from S3 session folder)
- `metadata.json` — reads session_id, started_at/ended_at for start/stop

## Tasks
See `.claude-tasks/` for task files prefixed with `aud-`

## Key Decisions
- ffmpeg with DirectShow (`-f dshow`) for Windows audio capture
- Auto-detect USB mic device name (different per PC)
- Session-triggered start/stop via S3 polling (not manual)
- Transcription is post-session (not real-time) — Whisper or cloud STT
- Must handle "stop audio" command (visitor objects to recording)
- WASAPI loopback capture for system audio is a future enhancement
