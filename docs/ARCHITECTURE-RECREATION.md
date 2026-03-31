# CaseyApp Architecture & Recreation Guide

Complete technical reference for the CaseyApp system. This document contains everything needed to understand, maintain, or fully recreate the system from scratch.

---

## 1. System Overview

### What CaseyApp Does

CaseyApp (also called BoothApp) is an AI-powered demo capture and follow-up system for trade show booths (Black Hat, AWS re:Invent, etc.). It records everything that happens during a live product demo -- screenshots, click tracking, and audio -- then uses Claude AI to generate a personalized follow-up summary for each visitor.

### Who It Is For

- **Sales Engineers (SEs)** -- run demos at the booth, use the Android app to start/stop sessions
- **SDR teams** -- receive AI-generated summaries and send personalized follow-up emails
- **Visitors** -- receive a summary of what they saw, plus a link to their own Vision One tenant

### Team: "Smells Like Machine Learning"

| Name | Focus |
|------|-------|
| Casey Mondoux (MKT-NA) | Android app, web interface, presentation |
| Joel Ginsberg (TS-NA) | Chrome extension, audio capture, AWS infra, AI analysis |
| Tom Gamull (SE-NA) | App development |
| Kush Mangat (SE-NA) | Presentation, demo |
| Chris LaFleur (BD-NA) | V1 tenant provisioning, presentation |

### End-to-End Demo Flow

1. Visitor walks up to booth. SE takes a photo of their badge using the **Android app**.
2. Badge photo goes through **ML Kit OCR** to extract name and company.
3. Android app calls the **Session Orchestrator** API to create a session.
4. Orchestrator writes `active-session.json` to S3, claims a V1 tenant, and writes start command for the demo PC.
5. **Chrome Extension** (on demo PC) polls S3 every 2 seconds, detects the active session, begins timed screenshots (1/sec) and click tracking.
6. **Packager** (on demo PC) polls S3, detects session, starts **audio recording** via ffmpeg.
7. SE gives the demo in the Vision One browser. All clicks, screenshots, and audio are captured.
8. SE taps "End Session" on the phone app. Orchestrator deletes `active-session.json` from S3.
9. Chrome Extension detects session end, POSTs accumulated click data to the Packager, signals `/session/end`.
10. Packager stops audio, converts WAV to MP3, creates a zip (screenshots + audio + clicks), uploads zip + manifest to S3.
11. **Analysis Watcher** polls S3 every 30 seconds, detects the completed session, claims it (writes marker), triggers the analysis pipeline.
12. Pipeline: correlates clicks+transcript into a timeline, runs Claude AI analysis, generates summary.json + follow-up.json, renders HTML report and email-ready HTML.
13. SDR team views session in the **Presenter Dashboard**, reviews the AI summary, and sends the follow-up email.
14. Visitor receives email with a link to their preserved V1 tenant (active for 30 days).

---

## 2. Architecture

### Component Diagram

```
+-------------------+         +------------------------+         +-------------------+
|   Android App     |         |       AWS S3           |         |    Demo PC        |
|                   |         |  (Data Plane)          |         |                   |
| - Badge OCR       | ------> | active-session.json    | <------ | - Chrome Extension|
| - QR Pairing      |  HTTP   | sessions/<id>/         |  Poll   |   (screenshots,   |
| - Start/End       |         |   metadata.json        |  2s     |    click tracking)|
|   Session         |         |   commands/             |         |                   |
|                   |         |   <name>_<id>.zip      |         | - Packager Server |
+-------------------+         |   package-manifest.json|         |   (HTTP :9222)    |
        |                     |   output/              |         |                   |
        |  HTTP               |     summary.json       |         | - Audio Recorder  |
        v                     |     summary.html       |         |   (ffmpeg)        |
+-------------------+         |     follow-up.json     |         +-------------------+
| Session           |         |     email-ready.html   |
| Orchestrator      | ------> |     timeline.json      |
| (Lambda / HTTP)   |  S3 API | tenant-pool/           |
|                   |         |   tenants.json         |
| - Create session  |         |   locks/<tenant-id>    |
| - End session     |         +------------------------+
| - Stop audio      |                   |
| - State machine   |                   | Poll 30s
| - Tenant pool     |                   v
+-------------------+         +------------------------+
                              | Analysis Pipeline      |
+-------------------+         |                        |
| Presenter         |         | - Watcher (Node.js)    |
| Dashboard         | <------ | - Correlator (Node.js) |
| (Express :3000)   |  S3 API | - Claude AI (Python)   |
|                   |         | - HTML Report (Node.js)|
| - 30+ HTML pages  |         | - Email Report         |
| - Session viewer  |         | - Notification         |
| - Analytics       |         +------------------------+
| - Session create  |
+-------------------+
```

### Communication Flow

All inter-component communication happens through **S3**. There are no direct service-to-service calls between the Android app, demo PC, and analysis pipeline. The only direct HTTP calls are:

1. **Android App -> Session Orchestrator**: HTTP POST to create/end sessions (orchestrator writes to S3)
2. **Chrome Extension -> Packager**: HTTP POST to localhost:9222 for screenshots and clicks (both on same demo PC)
3. **Presenter Dashboard -> S3**: Server-side reads via AWS SDK for session data display

### Why S3 as the Data Plane

- **Decoupling**: Components can be developed, deployed, and restarted independently. The Android app does not need to know where the demo PC is, and vice versa.
- **Reliability**: S3 is durable storage. If any component crashes, data is preserved and the session can be recovered.
- **Simplicity**: No message brokers, no WebSocket servers, no service mesh. Polling S3 is simple and stateless.
- **Presence-based signaling**: Commands like "stop audio" and "end session" use file presence (write a file = signal sent, delete file = signal cleared). No ack/nack needed.
- **Cost**: At trade show scale (dozens of sessions per day), S3 costs are negligible.

---

## 3. Components

### 3a. Chrome Extension (V1-Helper)

**Purpose**: Captures timed screenshots and click data during a Vision One demo. Polls S3 for session lifecycle. POSTs screenshots and click data to the local Packager service.

**Technology**: Chrome Extension (Manifest V3), vanilla JavaScript, service worker.

**Key Files**:

| File | Description |
|------|-------------|
| `extension/manifest.json` | Manifest V3 config; name "V1-Helper", version 1.1.0 |
| `extension/background.js` | Service worker: timed screenshots, S3 polling (SigV4 signed), packager communication |
| `extension/content.js` | Content script: click interception, DOM path builder, click buffer in chrome.storage.local |
| `extension/popup.js` | Popup UI: session status, click count, S3 connection test |
| `extension/popup.html` | Popup HTML |
| `extension/qrcode.min.js` | QR code generation library (branded) |

**How It Works**:

1. Background service worker polls S3 `active-session.json` every 2 seconds using SigV4-signed GET requests.
2. When a session becomes active: starts timed screenshots at configurable interval (default 1000ms).
3. Screenshots are captured via `chrome.tabs.captureVisibleTab()`, resized per quality preset, POSTed to `http://127.0.0.1:9222/screenshots` with `X-Filename` header.
4. Content script intercepts all click events (capture phase), builds a DOM path, extracts element info (tag, id, class, text, href, field labels), and stores events in `chrome.storage.local`.
5. When session ends (active-session.json removed): stops screenshots, POSTs accumulated click data to packager `/clicks`, signals `/session/end`.
6. A red banner "This session is tracked -- you will receive a summary" is shown in the top frame during active sessions.

**Screenshot Naming**: `screenshot_<MM>m<SS>s<mmm>.jpg` where MM/SS/mmm are elapsed time from session start.

**Quality Presets**:

| Preset | Max Width | Max Height | JPEG Quality |
|--------|-----------|------------|--------------|
| low | 854 | 480 | 0.4 |
| medium | 1280 | 720 | 0.6 |
| high | 1920 | 1080 | 0.8 |

**S3 Keys Read**: `active-session.json`

**Configuration** (via `chrome.storage.local`):
- `s3Bucket` -- S3 bucket name
- `s3Region` -- AWS region
- `awsAccessKeyId` -- AWS access key
- `awsSecretAccessKey` -- AWS secret key
- `awsSessionToken` -- (optional) STS session token
- `screenshotIntervalMs` -- screenshot interval in ms (default 1000)
- `screenshotQuality` -- `low`, `medium`, or `high` (default `medium`)

**How to Build/Run**:
```bash
# Load as unpacked extension in Chrome
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select the extension/ directory
# 4. Configure S3 credentials in the popup settings
```

---

### 3b. Demo PC Packager

**Purpose**: Local HTTP server running on the demo PC. Receives screenshots and click data from the Chrome Extension, manages audio recording, packages all session data into a zip file, and uploads to S3.

**Technology**: Node.js 18+, plain `http` module (no framework), `archiver` for zip, `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` for S3.

**Key Files**:

| File | Description |
|------|-------------|
| `packager/server.js` | HTTP server on port 9222, CORS, routes |
| `packager/lib/session-manager.js` | Session lifecycle: S3 polling, screenshot/click collection, session start/end events |
| `packager/lib/audio-manager.js` | ffmpeg mic detection, WAV recording, MP3 conversion |
| `packager/lib/packager.js` | Zip creation, S3 upload, manifest generation |
| `packager/package.json` | Dependencies: archiver, @aws-sdk/client-s3, @aws-sdk/lib-storage |

**HTTP API** (localhost:9222):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/screenshots` | Receive a screenshot (binary body, `X-Filename` header) |
| POST | `/clicks` | Receive click data (JSON body) |
| POST | `/session/end` | Trigger packaging and upload |
| GET | `/status` | Get packager status (session, screenshot count, audio state) |

**S3 Keys Read**: `active-session.json` (polled every 2000ms)

**S3 Keys Written**:
- `sessions/<id>/<Visitor_Name>_<id>.zip` -- packaged session zip
- `sessions/<id>/package-manifest.json` -- manifest with file counts and sizes

**Zip Contents**:
```
screenshots/
  screenshot_00m00s000.jpg
  screenshot_00m01s012.jpg
  ...
audio/
  recording.mp3          (absent if audio opted out)
clicks/
  clicks.json
```

**Configuration** (environment variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9222` | HTTP server port |
| `S3_BUCKET` | `boothapp-sessions-752266476357` | S3 bucket name |
| `AWS_REGION` | `us-east-1` | AWS region |
| `POLL_INTERVAL_MS` | `2000` | S3 polling interval (ms) |
| `AUDIO_DEVICE` | (auto-detect) | Override ffmpeg audio device name |

**How to Build/Run**:
```bash
cd packager
npm install
npm start
# Listens on http://127.0.0.1:9222
```

---

### 3c. Audio Recorder

**Purpose**: Session-triggered ffmpeg audio capture for trade show demos. Records USB microphone to WAV, converts to MP3. Can run standalone or is managed by the Packager's AudioManager.

**Technology**: Node.js 18+, ffmpeg (DirectShow on Windows), `@aws-sdk/client-s3`.

**Key Files**:

| File | Description |
|------|-------------|
| `audio/recorder.js` | Standalone entry point: polls S3 for session, records, uploads |
| `audio/lib/device-detect.js` | ffmpeg device enumeration, USB mic auto-detection with keyword scoring |
| `audio/lib/ffmpeg-recorder.js` | ffmpeg process wrapper (start/stop/error events) |
| `audio/lib/s3-upload.js` | Upload WAV/MP3 + transcript to S3 |
| `audio/lib/session-poller.js` | S3 session lifecycle poller (start/stop events) |
| `audio/lib/visualizer.js` | Audio level visualization |
| `packager/lib/audio-manager.js` | Integrated audio manager used by the Packager |

**Audio Pipeline**:
1. Auto-detect USB/wireless microphone using `ffmpeg -list_devices true -f dshow -i dummy`
2. Score devices by keywords: usb, wireless, microphone, yeti, rode, shure, etc.
3. Record to WAV: 44100Hz, stereo, PCM s16le via DirectShow
4. On session end: graceful stop (send 'q' to ffmpeg), convert WAV to MP3 (libmp3lame VBR quality 2)
5. Upload MP3 to S3 (WAV stays on demo PC)

**Configuration**:

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | (required) | S3 bucket name |
| `SESSION_ID` | (required) | Session ID to record |
| `AUDIO_DEVICE` | (auto-detect) | Override mic device name |
| `POLL_INTERVAL_MS` | `2000` | S3 polling interval |
| `AWS_REGION` | `us-east-1` | AWS region |
| `OUTPUT_DIR` | `./output/<session_id>` | Local output directory |

**How to Build/Run** (standalone):
```bash
cd audio
npm install
S3_BUCKET=boothapp-sessions-752266476357 SESSION_ID=ABC12345 npm start
```

The audio recorder is typically not run standalone -- it is managed by the Packager's AudioManager class, which starts/stops ffmpeg as part of the session lifecycle.

**Prerequisites**: ffmpeg must be installed and on PATH. On Windows, DirectShow (`-f dshow`) is used for audio capture.

---

### 3d. Android App

**Purpose**: Mobile app used by SEs at the booth. Takes badge photos, runs OCR to extract visitor name/company, creates sessions via the orchestrator API, and controls session lifecycle (start, stop audio, end).

**Technology**: Kotlin, Android SDK (compileSdk 34, minSdk 33), CameraX, Google ML Kit (Text Recognition), OkHttp, Gson, AWS S3 SDK.

**Key Files**:

| File | Description |
|------|-------------|
| `android/app/src/main/java/com/trendmicro/boothapp/ui/MainActivity.kt` | Main screen: camera preview, badge capture, OCR, session start/end |
| `android/app/src/main/java/com/trendmicro/boothapp/ui/SettingsActivity.kt` | Settings: orchestrator URL, demo PC name, SE name |
| `android/app/src/main/java/com/trendmicro/boothapp/ui/QrScanActivity.kt` | QR code scanning for demo PC pairing |
| `android/app/src/main/java/com/trendmicro/boothapp/camera/CameraManager.kt` | CameraX integration for badge photo capture |
| `android/app/src/main/java/com/trendmicro/boothapp/ocr/BadgeOcrProcessor.kt` | ML Kit OCR: extracts name/company from badge photo, filters noise (event names, dates, badge codes) |
| `android/app/src/main/java/com/trendmicro/boothapp/data/SessionApi.kt` | HTTP client for orchestrator API (create session, end session, stop audio) |
| `android/app/src/main/java/com/trendmicro/boothapp/data/S3Uploader.kt` | Badge photo upload to S3 |
| `android/app/src/main/java/com/trendmicro/boothapp/data/AppPreferences.kt` | SharedPreferences wrapper for app settings |
| `android/app/build.gradle.kts` | Build config with S3_BUCKET, AWS_REGION, ORCHESTRATOR_URL build fields |

**Key Dependencies** (from build.gradle.kts):
- `androidx.camera:camera-*:1.3.1` (CameraX)
- `com.google.mlkit:text-recognition` (ML Kit OCR)
- `com.squareup.okhttp3:okhttp` (HTTP client)
- `com.google.code.gson:gson` (JSON)
- `com.google.android.material:material:1.11.0`
- `androidx.security:security-crypto` (encrypted preferences)

**API Calls** (to Session Orchestrator):
- `POST /sessions` -- create session (sends visitor_name, visitor_company, demo_pc, se_name, audio_consent)
- `POST /sessions/:id/end` -- end session
- `POST /sessions/:id/stop-audio` -- stop audio recording mid-demo

**Build Configuration** (build.gradle.kts buildConfigFields):
- `S3_BUCKET` -- default `"boothapp-sessions-752266476357"`
- `AWS_REGION` -- default `"us-east-1"`
- `ORCHESTRATOR_URL` -- default `""` (set at runtime via settings)

**How to Build/Run**:
```bash
cd android
# Open in Android Studio or build from command line:
./gradlew assembleDebug
# APK output: app/build/outputs/apk/debug/app-debug.apk
# Install on device:
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

### 3e. Session Orchestrator

**Purpose**: Central session lifecycle manager. Creates sessions, tracks state transitions, manages V1 tenant pool, signals demo PCs via S3 command files. Runs as a Lambda function (API Gateway) or local HTTP server.

**Technology**: Node.js 20+, `@aws-sdk/client-s3`, deployable as AWS Lambda or standalone HTTP server.

**Key Files**:

| File | Description |
|------|-------------|
| `infra/session-orchestrator/index.js` | Lambda handler + local HTTP server, route table |
| `infra/session-orchestrator/orchestrator.js` | Core logic: createSession, endSession, stopAudio, state machine |
| `infra/session-orchestrator/s3.js` | S3 helper functions (putObject, getObject, objectExists, deleteObject, listPrefixes) |
| `infra/session-orchestrator/tenant-pool.js` | V1 tenant pool: atomic claim via S3 conditional put, release |

**HTTP API**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/sessions` | List all sessions with metadata + analysis status |
| POST | `/sessions` | Create session (called by Android app on badge scan) |
| POST | `/sessions/:id/end` | End session |
| POST | `/sessions/:id/stop-audio` | Stop audio, continue screenshots |
| GET | `/sessions/:id` | Get session metadata + command flags |
| GET | `/sessions/:id/state` | Get session lifecycle state + history |
| POST | `/sessions/:id/state` | Transition to new state (explicit state machine) |

**Session State Machine**:
```
active -> recording -> ended -> processing -> analyzed -> reviewed -> sent
  |                                                                    |
  +--- (can skip recording if no audio) ---> ended                     |
                                                              (terminal state)
```
Valid transitions are enforced. Each transition writes `sessions/<id>/state.json` with full history.

**S3 Keys Written on Session Create**:
- `sessions/<id>/metadata.json` -- session metadata
- `sessions/<id>/state.json` -- state machine history
- `sessions/<id>/v1-tenant/tenant.json` -- claimed tenant info
- `commands/<demo_pc>/start.json` -- start signal for demo PC
- `active-session.json` -- global active session indicator

**S3 Keys Deleted on Session End**:
- `active-session.json` -- signals Chrome Extension to stop

**Tenant Pool**:
- Pool state: `tenant-pool/tenants.json` (array of available tenants)
- Atomic locking: `tenant-pool/locks/<tenant-id>` using S3 conditional put (`IfNoneMatch: *`)
- Each tenant preserved 30 days after claim
- Pool target: 15 tenants (6 active, 6 warming, 3 buffer)

**CORS Allowed Origins**:
- `https://boothapp.trendcyberrange.com`
- `https://hackathon.trendcyberrange.com`
- `http://localhost:3000`

**Configuration**:

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | (required) | S3 bucket name |
| `AWS_REGION` | `us-east-1` | AWS region |
| `PORT` | `3000` | HTTP server port (local mode) |

**How to Build/Run**:
```bash
cd infra/session-orchestrator
npm install

# Local development:
S3_BUCKET=boothapp-sessions-752266476357 node index.js

# Lambda deployment: zip index.js + orchestrator.js + s3.js + tenant-pool.js + node_modules
```

---

### 3f. Presenter Dashboard

**Purpose**: Web dashboard for SEs, SDRs, and managers. Displays all sessions, AI-generated summaries, analytics, session viewer with screenshot replay, and a web fallback for session creation (when the Android app is unavailable).

**Technology**: Node.js 18+, Express 4, `@aws-sdk/client-s3`, static HTML pages (no frontend framework), CORS, Helmet, express-rate-limit.

**Key Files**:

| File | Description |
|------|-------------|
| `presenter/server.js` | Express server, API routes, session create/end endpoints, static file serving |
| `presenter/lib/sessions.js` | Session API routes with S3 caching (list, detail, tags, files) |
| `presenter/lib/batch-analyze.js` | Batch analysis trigger API |
| `presenter/lib/screenshots.js` | Screenshot serving API |
| `presenter/lib/shortcuts.js` | Keyboard shortcuts |
| `presenter/index.html` | Main dashboard landing page |
| `presenter/sessions.html` | Session list view |
| `presenter/session.html` | Individual session detail |
| `presenter/session-viewer.html` | Session viewer with screenshot replay |
| `presenter/analytics.html` | Analytics dashboard |
| `presenter/live-dashboard.html` | Live session monitoring |
| `presenter/create-session.html` | Web form session creation (Android app fallback) |
| `presenter/feedback.html` | Visitor feedback form |
| `presenter/share.html` | Public shareable session summary |
| `presenter/slides.html` | Presentation slides |
| `presenter/admin.html` | Admin panel |
| `presenter/replay.html` | Session replay |
| `presenter/meeting-prep.html` | Meeting prep brief generator |
| `presenter/coverage.html` | Product coverage matrix heatmap |
| `presenter/heatmap.html` | Click heatmap visualization |
| Plus ~20 more HTML pages | Various views and tools |

**Server API**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with uptime and version |
| GET | `/api/config` | Server configuration (bucket, region, port) |
| GET | `/api/pages` | List all HTML pages |
| GET | `/api/sessions` | List sessions (with optional `?include=analysis`) |
| GET | `/api/sessions/:id` | Session detail (parallel S3 fetch, cached) |
| PUT | `/api/sessions/:id/tags` | Add a tag to session |
| DELETE | `/api/sessions/:id/tags/:tag` | Remove a tag |
| GET | `/api/sessions/:id/files/:subfolder` | List files in session subfolder |
| POST | `/api/create-session` | Create session via web form (writes to S3) |
| POST | `/api/end-session` | End session via web form |
| GET | `/api/share/:sessionId` | Get shareable link |
| POST | `/api/errors` | Client-side error logging |
| GET | `/api/errors` | Retrieve logged client errors |
| GET | `/api/cache-stats` | S3 cache diagnostics |

**Configuration**:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `S3_BUCKET` | `boothapp-sessions-752266476357` | S3 bucket name |
| `AWS_REGION` | `us-east-1` | AWS region |
| `BASE_URL` | (auto-detect) | Base URL for share links |
| `S3_CACHE_TTL` | `60000` | S3 cache TTL in ms |

**How to Build/Run**:
```bash
cd presenter
npm install
npm start
# Open http://localhost:3000
```

---

### 3g. Analysis Pipeline

**Purpose**: Watches for completed sessions in S3, correlates click data with audio transcript into a unified timeline, runs Claude AI analysis, generates HTML summary report and email-ready HTML, sends completion notifications.

**Technology**: Node.js 18+ (watcher, correlator, report renderer), Python 3.9+ (Claude analysis, screenshot annotation), `@aws-sdk/client-s3`, `anthropic` Python SDK, `boto3`, `Pillow`.

**Key Files**:

| File | Description |
|------|-------------|
| `analysis/watcher.js` | S3 poller: checks sessions every 30s, claims completed sessions, triggers pipeline |
| `analysis/pipeline-run.js` | Pipeline orchestrator: fetch data, correlate, analyze, render, notify |
| `analysis/lib/correlator.js` | Merges clicks.json + transcript.json into unified timeline with screenshot matching |
| `analysis/lib/pipeline.js` | Pipeline trigger: spawns pipeline-run.js as child process with 120s timeout |
| `analysis/lib/s3.js` | S3 helpers for watcher (listSessions, isComplete, claim markers) |
| `analysis/lib/retry.js` | Retry with exponential backoff (configurable max retries, delay, multiplier) |
| `analysis/lib/notify.js` | Completion notification sender |
| `analysis/lib/status.js` | Pipeline status tracker (writes status to S3) |
| `analysis/analyze.py` | Python entry point for Claude analysis (calls engines/) |
| `analysis/engines/analyzer.py` | SessionAnalyzer class: sends session data to Claude |
| `analysis/engines/claude_client.py` | Claude API client (supports direct API and Bedrock) |
| `analysis/engines/annotator.py` | Screenshot annotation with click markers |
| `analysis/engines/prompts.py` | Claude prompt templates for session analysis |
| `analysis/engines/product_detector.py` | Product topic detection from URLs and text |
| `analysis/engines/competitive.py` | Competitive intelligence from transcript |
| `analysis/engines/email_template.py` | Follow-up email template generation |
| `analysis/engines/validator.py` | Session data validation |
| `analysis/render-report.js` | HTML report generator (template-based, {{placeholder}} syntax) |
| `analysis/email-report.js` | Email-ready HTML generator (table-based layout for email clients) |
| `analysis/watcher-health.js` | Health monitoring (HTTP :8095, file-based, log rotation) |
| `analysis/templates/report.html` | HTML report template |

**Pipeline Steps** (executed by pipeline-run.js):

1. **Fetch** -- Download metadata.json, clicks.json, transcript.json, screenshot list from S3
2. **Correlate** -- Merge clicks + transcript into chronological timeline (correlator.js)
   - Matches screenshots to events by timestamp proximity (binary search, 5s window)
   - Cross-references clicks with speech (what was being said when a click happened)
   - Detects product topics (Endpoint Security, XDR, Risk Insights, etc.) from URLs, page titles, DOM paths, speech text
   - Computes engagement score (0-10) from click frequency, visitor speech ratio, question count, session duration, topic diversity
3. **Write Timeline** -- Upload timeline.json to S3
4. **Annotate** -- Run annotator.py to overlay click markers on screenshots
5. **Analyze** -- Run analyze.py with Claude AI to generate summary.json and follow-up.json
6. **Fallback** -- If AI analysis fails, write a fallback summary with basic metadata
7. **Render Report** -- Generate summary.html from template + data
8. **Email Report** -- Generate email-ready.html (table-based layout)
9. **Notify** -- Send completion notification

**Session Completion Criteria** (checked by watcher):
1. `sessions/<id>/metadata.json` has `status == 'completed'`
2. `sessions/<id>/clicks/clicks.json` exists
3. `sessions/<id>/transcript/transcript.json` exists

**Retry Policy**: Bedrock/Claude API errors get up to 4 attempts with 3x backoff (5s, 15s, 45s). Non-retryable errors fail immediately.

**S3 Keys Written**:
- `sessions/<id>/output/timeline.json`
- `sessions/<id>/output/summary.json`
- `sessions/<id>/output/summary.html`
- `sessions/<id>/output/follow-up.json`
- `sessions/<id>/output/email-ready.html`
- `sessions/<id>/output/.analysis-claimed` (deduplication marker)
- `sessions/<id>/output/errors.json` (if any pipeline errors)

**Configuration**:

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | (required) | S3 bucket name |
| `AWS_REGION` | (required) | AWS region |
| `AWS_ACCESS_KEY_ID` | (required*) | AWS access key (* or use profile/role) |
| `AWS_SECRET_ACCESS_KEY` | (required*) | AWS secret key |
| `USE_BEDROCK` | (optional) | Set to `1` to use Bedrock for Claude |
| `ANALYSIS_MODEL` | (required if USE_BEDROCK=1) | Bedrock model ID |
| `ANTHROPIC_API_KEY` | (optional) | Direct Anthropic API key |
| `POLL_INTERVAL_SECONDS` | `30` | Watcher poll interval |
| `HEALTH_PORT` | `8090` | Legacy health check port |

**Python Requirements** (`analysis/requirements.txt`):
```
anthropic>=0.40.0
boto3>=1.34.0
Pillow>=10.0.0
```

**How to Build/Run**:
```bash
# Node.js dependencies
cd analysis
npm install

# Python dependencies
pip install -r requirements.txt

# Run watcher
S3_BUCKET=boothapp-sessions-752266476357 AWS_REGION=us-east-1 node watcher.js

# Test notification
node watcher.js --test

# Run report renderer standalone
node render-report.js s3://boothapp-sessions-752266476357/sessions/ABC12345
```

---

## 4. Data Contract

### S3 Folder Structure (v2 Zip-Based)

```
sessions/<session-id>/
  metadata.json                           # Session metadata (Android app / web form)
  badge.jpg                               # Badge photo (Android app)
  state.json                              # State machine history (orchestrator)
  commands/
    stop-audio                            # Presence = audio opted out (orchestrator)
  <Visitor_Name>_<session_id>.zip         # Packaged session data (demo PC packager)
    screenshots/
      screenshot_00m00s000.jpg
      screenshot_00m01s012.jpg
      ...
    audio/
      recording.mp3                       # Absent if audio opted out
    clicks/
      clicks.json
  package-manifest.json                   # Zip metadata (demo PC packager)
  v1-tenant/
    tenant.json                           # Claimed V1 tenant info
  output/                                 # Analysis pipeline outputs
    timeline.json
    summary.json
    summary.html
    follow-up.json
    follow-up-email.html
    email-ready.html
    .analysis-claimed                     # Deduplication marker
    errors.json                           # Pipeline errors (if any)
    notes.json                            # SE/manager session notes
  feedback.json                           # Visitor feedback form
```

### Key Schemas

#### metadata.json
```json
{
  "session_id": "A726594",
  "visitor_name": "Joel Ginsberg",
  "visitor_company": "Acme Corp",
  "badge_photo": "badge.jpg",
  "started_at": "2026-08-05T14:32:00Z",
  "ended_at": "2026-08-05T14:47:00Z",
  "demo_pc": "booth-pc-3",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed",
  "tags": ["hot-lead", "follow-up-needed"]
}
```

#### clicks.json
```json
{
  "session_id": "A726594",
  "events": [
    {
      "index": 1,
      "timestamp": "2026-08-05T14:32:15.123Z",
      "type": "click",
      "dom_path": "div.app-content > nav > a.endpoint-security",
      "element": {
        "tag": "a",
        "id": "ep-nav",
        "class": "endpoint-security",
        "text": "Endpoint Security",
        "href": "/app/endpoint-security",
        "selected_option": "",
        "field_label": ""
      },
      "coordinates": {"x": 450, "y": 120},
      "viewport_scroll": {"x": 0, "y": 0},
      "is_navigation": true,
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    }
  ]
}
```

#### package-manifest.json
```json
{
  "session_id": "ABC12345",
  "visitor_name": "Sarah Mitchell",
  "zip_key": "sessions/ABC12345/Sarah_Mitchell_ABC12345.zip",
  "zip_size_bytes": 52428800,
  "screenshot_count": 300,
  "has_audio": true,
  "has_clicks": true,
  "audio_opted_out": false,
  "created_at": "2026-04-01T14:30:00.000Z"
}
```

#### summary.json (AI-generated)
```json
{
  "session_id": "A726594",
  "visitor_name": "Joel Ginsberg",
  "products_demonstrated": ["Endpoint Security", "XDR", "Risk Insights"],
  "key_interests": [
    {"topic": "Endpoint policy management", "confidence": "high", "evidence": "Asked 3 questions about policy config"}
  ],
  "follow_up_actions": [
    "Send EP policy best practices guide",
    "Schedule deep-dive on XDR custom detection rules"
  ],
  "demo_duration_seconds": 900,
  "session_score": 8,
  "executive_summary": "Visitor showed strong interest in endpoint policy management...",
  "key_moments": [
    {"timestamp": "00:05:30", "screenshot": "click-012.jpg", "description": "Visitor asked about BYOD policy"}
  ],
  "generated_at": "2026-08-05T15:02:00Z"
}
```

#### follow-up.json (AI-generated)
```json
{
  "session_id": "A726594",
  "visitor_email": "joel@example.com",
  "subject": "Your Vision One Demo Summary",
  "summary_url": "https://.../summary.html",
  "tenant_url": "https://portal.xdr.trendmicro.com/...",
  "priority": "high",
  "tags": ["endpoint", "xdr", "enterprise"],
  "sdr_notes": "Visitor is a CISO, 5000 endpoints, comparing with Palo Alto"
}
```

### Screenshot Naming Convention

Format: `screenshot_<MM>m<SS>s<mmm>.jpg`

| Component | Description |
|-----------|-------------|
| `MM` | Minutes elapsed from session start, zero-padded |
| `SS` | Seconds elapsed, zero-padded |
| `mmm` | Milliseconds, zero-padded |

Screenshots are JPEG, max 1920x1080, quality 60 (medium preset). Captured by Chrome Extension `captureVisibleTab()`, POSTed to Packager at localhost:9222. Default interval: 1 screenshot per second.

### Session Lifecycle States

```
active -> recording -> ended -> processing -> analyzed -> reviewed -> sent
```

| State | Description |
|-------|-------------|
| `active` | Session created, demo PC notified, waiting for recording to start |
| `recording` | Audio capture started on demo PC |
| `ended` | End signal sent, demo PC uploading data |
| `processing` | Upload done, analysis pipeline running |
| `analyzed` | AI output ready (summary.json, follow-up.json) |
| `reviewed` | SE/SDR approved the summary |
| `sent` | Follow-up email delivered to visitor (terminal state) |

### Data Rules

- All timestamps: UTC ISO-8601
- All file paths: relative to session folder
- Session ID format: alphanumeric, 6-10 characters, uppercase
- Audio format: MP3 (libmp3lame VBR quality 2), converted from 44100Hz stereo WAV
- Zip naming: `<Visitor_Name>_<session_id>.zip` (name sanitized: non-alphanumeric removed, spaces to underscores)

---

## 5. Brand Guidelines Summary

The brand identity is "TrendAI" with the tagline "AI Fearlessly". Full brand guide: `brand/BRAND_GUIDE.md`.

### Color Palette

#### Primary Colors
| Name | Hex | Use |
|------|-----|-----|
| TrendAI Red | `#d71920` | Primary brand color, buttons, accents, links |
| Amber | `#ff9500` | Secondary accent, gradient endpoint |
| Signal | `#2e0fe4` | Secondary color, gradient accent |
| Black | `#000000` | Core brand color, backgrounds |
| White | `#ffffff` | Text on dark backgrounds |

#### Dark Theme (Default for Digital)
| Name | Hex | Use |
|------|-----|-----|
| Background | `#000000` | Page background |
| Card | `#0a0a0a` | Card/panel backgrounds |
| Input | `#111111` | Form input backgrounds |
| Border | `#1a1a1a` | Card borders, dividers |
| Input Border | `#333333` | Input field borders |

#### Text Colors
| Name | Hex | Use |
|------|-----|-----|
| Primary Text | `#e5e5e5` | Headings, body text |
| Secondary Text | `#888888` | Labels, captions, muted text |
| Muted Text | `#666666` | Very subtle text |
| Placeholder | `#444444` | Input placeholder text |
| Error | `#ff6b6f` | Error messages |

#### Status Colors
| Name | Hex | Use |
|------|-----|-----|
| Live/Active | `#d71920` | Live indicators |
| Success/Online | `#22c55e` | Online indicators |
| Warning | `#ff9500` | Warnings |
| Error | `#ff6b6f` | Errors, delete |

#### Extended
| Name | Hex | Use |
|------|-----|-----|
| TrendAI Red Dark | `#b81419` | Hover states |

### Typography

| Typeface | Role | Source |
|----------|------|--------|
| Gotham Bold | Primary headings | Adobe Fonts / `physical/fonts/Gotham/` |
| Work Sans | Body copy | Google Fonts / `digital/fonts/WorkSans/` |
| Inter | Product UI | Google Fonts / `digital/fonts/Inter/` |
| Aptos | Office fallback | System font / `digital/fonts/Aptos/` |

#### Font Weights
| Weight | Name | Use |
|--------|------|-----|
| 400 | Regular | Body text |
| 500 | Medium | Subtle emphasis |
| 600 | Semibold | Card titles |
| 700 | Bold | Headings, buttons, labels |

#### Key Text Styles
| Element | Font | Size | Weight | Transform |
|---------|------|------|--------|-----------|
| Page heading | Gotham | 18-20px | 700 | uppercase |
| Section heading | Gotham | 14px | 700 | uppercase |
| Body text | Work Sans | 14px | 400 | none |
| Label | Work Sans | 11px | 700 | uppercase |
| Button text | Work Sans | 13px | 700 | uppercase |

### Component Styles

#### Primary Button (Gradient)
```css
.btn-gradient {
  background: linear-gradient(135deg, #d71920 0%, #ff9500 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 24px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

#### Outline Button
```css
.btn-outline {
  background: transparent;
  color: #888;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
}
.btn-outline:hover { border-color: #d71920; color: #e5e5e5; }
```

#### Card
```css
.card {
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}
```

#### Input
```css
.input {
  background: #111;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14px;
  color: #e5e5e5;
}
.input:focus { border-color: #d71920; }
```

#### Label
```css
.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 8px;
}
```

### QR Code Generation

Three branded presets with TrendAI logo overlay:

| Style | Foreground | Background | Logo |
|-------|-----------|------------|------|
| red | `#d71920` | `#ffffff` | Full Color icon |
| black | `#000000` | `#ffffff` | Black icon |
| white | `#ffffff` | `#1a1a1a` | White icon |

Library: `brand/digital/qrcode.min.js` (client-side vanilla JS). Logo is overlaid at 22% of QR size with a padded background square.

### Key Brand Rules

- Dark mode is the default for all digital applications
- TrendAI Red must always be the prominent brand color
- Color ratios: 60% black, 30% TrendAI Red, 10% white (dark-dominant)
- Gradient direction: TrendAI Red to Amber, never reversed
- Clear space around logo: half the height of the logo
- ADA compliance: TrendAI Red on black only at 14pt bold+ or 18pt+ regular

---

## 6. Infrastructure

### AWS Account Setup

| Resource | Value |
|----------|-------|
| AWS Profile | `hackathon` |
| Region | `us-east-1` |
| S3 Bucket | `boothapp-sessions-752266476357` |
| Credentials | OS credential store (never in code) |

**S3 Bucket Structure** (top-level):
```
boothapp-sessions-752266476357/
  active-session.json          # Current active session (ephemeral)
  sessions/                    # All session data
    <session-id>/
      metadata.json
      ...
  commands/                    # Demo PC start/end commands
    <demo-pc>/
      start.json
      end.json
  tenant-pool/                 # V1 tenant pool
    tenants.json
    locks/<tenant-id>
    released/<tenant-id>.json
```

**Lambda** (Session Orchestrator):
- Runtime: Node.js 20.x
- Handler: `index.handler`
- Memory: 256 MB (sufficient for S3 operations)
- Timeout: 30 seconds
- Environment variables: `S3_BUCKET`, `AWS_REGION`
- Can be deployed behind API Gateway HTTP API or as a Function URL

### Required Tools

| Tool | Version | Used By |
|------|---------|---------|
| Node.js | 18+ (20+ for orchestrator) | All Node.js components |
| npm | (bundled with Node.js) | Package management |
| ffmpeg | Latest | Audio recording + MP3 conversion |
| Python | 3.9+ | Analysis pipeline (Claude analysis, screenshot annotation) |
| pip | (bundled with Python) | Python package management |
| Android SDK | compileSdk 34 | Android app |
| Android Studio | Latest | Android app development |
| Chrome | Latest | Chrome Extension |
| AWS CLI | v2 | Infrastructure management |

### Environment Variables Reference

| Variable | Component | Default | Description |
|----------|-----------|---------|-------------|
| `S3_BUCKET` | All | `boothapp-sessions-752266476357` | S3 bucket name |
| `AWS_REGION` | All | `us-east-1` | AWS region |
| `AWS_PROFILE` | All | `hackathon` | AWS credential profile |
| `PORT` | Packager | `9222` | Packager HTTP port |
| `PORT` | Presenter | `3000` | Dashboard HTTP port |
| `PORT` | Orchestrator | `3000` | Orchestrator HTTP port (local) |
| `POLL_INTERVAL_MS` | Packager | `2000` | S3 poll interval (ms) |
| `POLL_INTERVAL_SECONDS` | Watcher | `30` | Watcher poll interval (sec) |
| `AUDIO_DEVICE` | Packager/Audio | (auto-detect) | ffmpeg audio device override |
| `SESSION_ID` | Audio | (required) | Session ID for standalone recorder |
| `USE_BEDROCK` | Analysis | (optional) | Set `1` for Bedrock |
| `ANALYSIS_MODEL` | Analysis | (required if Bedrock) | Bedrock model ID |
| `ANTHROPIC_API_KEY` | Analysis | (optional) | Direct Anthropic API key |
| `HEALTH_PORT` | Watcher | `8090` | Health check HTTP port |
| `S3_CACHE_TTL` | Presenter | `60000` | S3 cache TTL (ms) |
| `BASE_URL` | Presenter | (auto-detect) | Base URL for share links |

### Resource Tagging

Tag all AWS resources with:
```
Project: BoothApp
Team: SmellsLikeMachineLearning
Environment: hackathon
```

---

## 7. Demo Walkthrough

### Prerequisites

1. AWS credentials configured (`aws configure --profile hackathon`)
2. S3 bucket created with appropriate permissions
3. Node.js 18+ installed on demo PC
4. ffmpeg installed and on PATH (demo PC)
5. Chrome browser with V1-Helper extension loaded
6. Android app installed on SE phone (or use web form fallback)
7. Session Orchestrator deployed (Lambda or local)

### Setup (Before Demo Day)

```bash
# 1. Start the Packager on each demo PC
cd packager && npm install && npm start
# Verify: http://127.0.0.1:9222/status returns JSON

# 2. Load Chrome Extension
# chrome://extensions -> Load unpacked -> select extension/ directory
# Configure S3 credentials in popup settings

# 3. Start the Presenter Dashboard
cd presenter && npm install && npm start
# Verify: http://localhost:3000 shows the dashboard

# 4. Start the Analysis Watcher
cd analysis && npm install && pip install -r requirements.txt
S3_BUCKET=boothapp-sessions-752266476357 AWS_REGION=us-east-1 node watcher.js

# 5. Configure the Android app
# Settings: set Orchestrator URL, Demo PC name, SE name
```

### Running a Demo

1. **SE opens Android app** and points camera at visitor's badge.
2. **Tap "Capture"** -- ML Kit OCR extracts name and company.
3. **Tap "Start Session"** -- app calls orchestrator, session created.
4. On the **demo PC**: Chrome Extension detects the session (within 2 seconds), starts capturing screenshots. Packager starts audio recording.
5. **SE gives the demo** in the Vision One browser. A red banner appears: "This session is tracked."
6. **Demo ends** -- SE taps "End Session" on the phone.
7. Chrome Extension stops screenshots, sends clicks to Packager, signals session end.
8. Packager packages zip (screenshots + MP3 + clicks), uploads to S3.
9. Analysis Watcher detects completed session, runs the analysis pipeline.
10. **Dashboard** shows the session with AI-generated summary, engagement score, and follow-up actions.
11. SDR reviews and sends the follow-up email.

### Web Form Fallback

If the Android app is unavailable, create sessions via the Presenter Dashboard:
1. Navigate to `http://localhost:3000/create-session.html`
2. Enter visitor name, company, demo PC ID
3. Click "Start Session"

---

## 8. Recreating This System

Follow these steps in order to rebuild the system from zero.

### Step 1: AWS Account and S3 Bucket

```bash
# Create S3 bucket
aws s3 mb s3://boothapp-sessions-YOUR_ACCOUNT_ID --region us-east-1

# Set bucket policy for appropriate access
# Create IAM user/role with S3 read/write permissions for this bucket
```

Configure bucket CORS for Chrome Extension direct access:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["chrome-extension://*", "https://boothapp.trendcyberrange.com"],
    "ExposeHeaders": []
  }
]
```

### Step 2: Build the Session Orchestrator

1. Create `infra/session-orchestrator/` with files: `index.js`, `orchestrator.js`, `s3.js`, `tenant-pool.js`
2. Implement the session state machine (active -> recording -> ended -> processing -> analyzed -> reviewed -> sent)
3. Implement `createSession()`: write metadata.json, state.json, tenant.json, start command, active-session.json
4. Implement `endSession()`: update metadata, write end command, delete active-session.json
5. Implement `stopAudio()`: write stop-audio command file, update active-session.json
6. Add input validation (session ID: 1-20 uppercase alphanumeric, demo PC: 1-50 alphanumeric/underscore/hyphen)
7. Deploy as Lambda behind API Gateway or run locally

### Step 3: Build the Packager Service

1. Create `packager/` with files: `server.js`, `lib/session-manager.js`, `lib/audio-manager.js`, `lib/packager.js`
2. Implement HTTP server on port 9222 with CORS
3. Implement S3 polling for `active-session.json` (every 2 seconds)
4. Implement screenshot collection: receive binary POST at `/screenshots`, save to `sessions/<id>/screenshots/`
5. Implement click data collection: receive JSON POST at `/clicks`, save to `sessions/<id>/clicks.json`
6. Implement audio recording: ffmpeg DirectShow capture, WAV to MP3 conversion
7. Implement packaging: create zip (archiver), upload to S3, write package-manifest.json
8. Handle `stop-audio` signal from S3

### Step 4: Build the Chrome Extension

1. Create `extension/` with Manifest V3 config: permissions `activeTab`, `tabs`, `storage`, host `<all_urls>`
2. Implement `background.js`: timed screenshots via `chrome.tabs.captureVisibleTab()`, S3 polling with SigV4 signing, packager communication
3. Implement `content.js`: click event listener (capture phase), DOM path builder, element info extractor, click buffer in chrome.storage.local
4. Implement screenshot naming with timecodes from session start
5. Implement quality presets and image resizing (OffscreenCanvas)
6. Add popup UI for configuration (S3 credentials, quality settings) and status display
7. Add session banner in top frame during active sessions

### Step 5: Build the Android App

1. Create Android project: `com.trendmicro.boothapp`, compileSdk 34, minSdk 33
2. Implement CameraX integration for badge photo capture
3. Implement ML Kit OCR badge processor with noise filtering (conference names, dates, badge codes, field labels)
4. Implement SessionApi client (OkHttp + Gson): POST /sessions, POST /sessions/:id/end, POST /sessions/:id/stop-audio
5. Implement S3Uploader for badge photo upload
6. Implement QR code scanning for demo PC pairing
7. Build UI: camera preview, capture button, name/company text fields, start/end session buttons

### Step 6: Build the Presenter Dashboard

1. Create `presenter/` with Express server
2. Implement API routes: health, config, sessions list (with S3 caching), session detail, create/end session
3. Create static HTML pages (dark theme, TrendAI brand):
   - `index.html` -- landing page
   - `sessions.html` -- session list
   - `session.html` -- session detail with AI summary
   - `create-session.html` -- web form session creation
   - `analytics.html` -- analytics dashboard
   - `live-dashboard.html` -- live monitoring
4. Add CORS, Helmet security headers, rate limiting (100 req/min/IP)
5. Add client-side error logging endpoint
6. Implement S3 cache layer for performance

### Step 7: Build the Analysis Pipeline

1. Create `analysis/` with Node.js watcher and Python analysis engines
2. Implement `watcher.js`: poll S3 every 30 seconds, check session completion criteria, claim via marker file, trigger pipeline
3. Implement `lib/correlator.js`: merge clicks + transcript, timestamp matching, product topic detection, engagement scoring
4. Implement Python `analyze.py` + `engines/`:
   - `analyzer.py`: SessionAnalyzer class that sends session data to Claude
   - `claude_client.py`: supports direct Anthropic API and AWS Bedrock
   - `prompts.py`: prompt templates for session analysis
   - `annotator.py`: overlay click markers on screenshots
5. Implement `render-report.js`: HTML template rendering with {{placeholder}} syntax
6. Implement `email-report.js`: email-compatible HTML (table-based layout)
7. Add retry logic with exponential backoff for Bedrock/Claude API calls
8. Add health monitoring (HTTP endpoint, file-based status)

### Step 8: Integrate and Test

1. Start all services: Orchestrator, Packager, Chrome Extension, Presenter, Watcher
2. Create a test session via the web form at `http://localhost:3000/create-session.html`
3. Verify Chrome Extension detects the session and starts screenshots
4. Verify Packager starts audio recording
5. Click around in the browser, then end the session
6. Verify zip is created and uploaded to S3
7. Verify Watcher detects the completed session and triggers analysis
8. Verify summary.html is generated and viewable in the Presenter Dashboard
9. End-to-end test with the Android app

### Key Design Principles

- **S3 as the only data plane**: No direct service-to-service calls (except local demo PC). This makes the system resilient to component failures.
- **Presence-based signaling**: Command files use file presence (exists = signal sent). No ack/nack protocol needed.
- **Polling over push**: All components poll S3 at intervals. Simpler than WebSockets/SNS for this scale.
- **Graceful degradation**: If audio fails, screenshots continue. If AI analysis fails, a fallback summary is written.
- **One thing well**: Each component has a single responsibility. The packager does not do analysis. The extension does not do S3 uploads.
- **Configuration via environment**: Never hardcode credentials, bucket names, or URLs. Use environment variables with sensible defaults.
