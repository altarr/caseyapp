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

---

## Module: recorder.js

Session-triggered audio recorder. Polls S3 for session lifecycle, starts/stops
ffmpeg automatically. No interactive prompts.

### Prerequisites

- Windows PC with ffmpeg on PATH (`winget install ffmpeg` or from ffmpeg.org)
- USB/wireless microphone plugged in
- Node.js 18+
- AWS credentials configured (`hackathon` profile or env vars)

### Install

```cmd
cd audio
npm install
```

### Run

```cmd
set S3_BUCKET=boothapp-sessions-123456789012
set SESSION_ID=A726594
node recorder.js
```

Recorder waits for session `active` in S3, starts recording, stops automatically
when `completed` or `ended_at` is set.

### Configuration

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `S3_BUCKET` | YES | — | S3 bucket holding session folders |
| `SESSION_ID` | YES | — | Session ID to watch |
| `AUDIO_DEVICE` | No | auto-detect | dshow device name (skip auto-detect) |
| `POLL_INTERVAL_MS` | No | 2000 | S3 poll interval in milliseconds |
| `AWS_REGION` | No | us-east-1 | AWS region |
| `AWS_PROFILE` | No | hackathon | AWS credentials profile |
| `OUTPUT_DIR` | No | `./output/<SESSION_ID>` | Local directory for WAV output |

### Manual Stop

Press `Ctrl+C` — recorder stops ffmpeg cleanly (no corrupted WAV).

### Stop Audio Command

If a visitor objects to recording, create this S3 object (empty body):
```
sessions/<SESSION_ID>/commands/stop-audio
```
Recorder detects it within one poll interval and stops.

### List Available Devices

```cmd
npm run list-devices
```

Prints all dshow audio device names. Use one with `AUDIO_DEVICE` if
auto-detect picks the wrong mic.

### Auto-Detection Logic

Scans device names for keywords: `usb`, `wireless`, `microphone`, `mic`,
`headset`, `yeti`, `blue`, `rode`, `shure`. Picks highest-scoring device.
Fails with a helpful error listing all devices if no match found.

---

## File Structure

```
audio/
├── recorder.js           # Main entry point — orchestrates everything
├── package.json
├── README.md
└── lib/
    ├── device-detect.js  # USB mic auto-detection via ffmpeg dshow
    ├── session-poller.js # S3 polling for session start/stop events
    └── ffmpeg-recorder.js # ffmpeg wrapper with graceful stop
```

---

## Tests

From task file `aud-01-recorder.json`:

1. **No USB mic** → error listing available devices, exits non-zero
2. **Valid device** → WAV file created at output path, 44100Hz stereo
3. **Stop signal (Ctrl+C)** → recording stops cleanly, WAV is valid (not truncated)
4. **10-minute recording** → ~100MB WAV, no gaps in audio
5. **Multiple audio devices** → auto-detect picks correct USB mic
