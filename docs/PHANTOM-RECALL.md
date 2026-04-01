# Phantom Recall -- Comprehensive System Documentation

**Product:** Phantom Recall by TrendAI
**Team:** Smells Like Machine Learning
**Repository:** caseyapp

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Details](#3-component-details)
4. [Data Flow](#4-data-flow)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [S3 Data Structure](#7-s3-data-structure)
8. [Authentication](#8-authentication)
9. [Deployment](#9-deployment)
10. [AWS Resources](#10-aws-resources)
12. [Troubleshooting](#11-troubleshooting)

---

## 1. Project Overview

### What It Is

Phantom Recall is an AI-powered demo capture and follow-up system built for trade show booths (Black Hat, AWS re:Invent, RSA, etc.). It records everything that happens during a live product demo -- screenshots, audio, click tracking -- and uses AI to generate personalized follow-up summaries for each booth visitor.

### The Problem It Solves

At trade shows, Sales Engineers (SEs) give dozens of demos per day. After the event, they struggle to remember who saw what, what questions were asked, and what follow-up is needed. Phantom Recall eliminates this by automatically capturing and analyzing every demo session, producing structured summaries that SDR teams can act on immediately.

### Who It Is For

- **Sales Engineers** giving live demos at booths
- **SDR/BDR Teams** doing post-event follow-up
- **Marketing Teams** analyzing visitor engagement and interest patterns
- **Booth Visitors** who receive personalized session recaps and access to demo environments

### How It Works (High Level)

1. SE scans visitor badge with Android app (camera OCR extracts name/company)
2. A session starts automatically on the demo PC -- Chrome extension captures screenshots (1/sec), click events, and audio recording begins
3. SE gives the demo in the browser (Vision One or any web product)
4. SE taps "End Session" on the phone when done
5. Demo PC packages all artifacts (screenshots, audio, clicks) into a ZIP, uploads to AWS S3
6. Management server imports the session, sends audio to AWS Transcribe, then sends transcript + sampled screenshots to Claude AI for analysis
7. Claude produces a structured summary: who the visitor was, what was demonstrated, what interested them, recommended follow-up
8. SDR team reviews summaries in the management dashboard

### Team Members

| Name | Focus Area |
|------|-----------|
| Casey Mondoux (MKT-NA) | Android app, web interface, presentation |
| Joel Ginsberg (TS-NA) | Chrome extension, audio capture, AWS infra, AI analysis |
| Tom Gamull (SE-NA) | App development |
| Kush Mangat (SE-NA) | Presentation, demo |
| Chris LaFleur (BD-NA) | V1 tenant provisioning, presentation |

---

## 2. Architecture Diagram

```
                           MANAGEMENT SERVER
                        (caseyapp.trendcyberrange.com)
                          EC2 t3.small / port 4000
                          nginx reverse proxy (443)
                         +------------------------+
                         |                        |
    ANDROID APP          |  Express.js API        |        CLAUDE AI (RONE)
    (SE's phone)         |  SQLite DB             |       +----------------+
   +--------------+      |  Auth / Users          |       |                |
   | Badge Photo  |----->|  Event Management      |------>| Session        |
   | (camera OCR) | POST |  Badge Training (AI)   | API   | Analysis       |
   | Session      | /api |  Contact Matching (AI) |<------| (transcript +  |
   | Create/End   |      |  Session Import        |       |  screenshots)  |
   | Audio Upload |      |  Session Analysis      |       +----------------+
   +--------------+      |                        |
        |                +----+----------+--------+
        |                     |          |
        | QR Pair             |          |
        v                     v          v
   +-----------+         +--------+  +-----------+
   | DEMO PC   |         | AWS S3 |  | AWS       |
   | (Windows) |         | Bucket |  | Transcribe|
   +-----------+         +--------+  +-----------+
   |                       ^    |
   | PACKAGER              |    | Audio file
   | (localhost:9222)      |    | upload for
   | - Polls S3 for       |    | transcription
   |   active-session.json |    |
   | - Receives screenshots|    |
   |   from extension      |    |
   | - Records audio (ffmpeg)   |
   | - Packages ZIP        |    |
   | - Uploads to S3 ------+    |
   |                            |
   | PRESENTER                  |
   | (localhost:3000)           |
   | - SE-facing dashboard      |
   | - Session viewer           |
   | - Feedback forms           |
   |                            |
   | CHROME EXTENSION           |
   | - Captures screenshots     |
   |   (1/sec via              |
   |    captureVisibleTab)      |
   | - Tracks clicks           |
   | - POSTs to packager       |
   |   at localhost:9222       |
   +-----------+               |
               |               |
               +---------------+

DATA FLOW SUMMARY:
  Phone  --[badge photo, session create/end, audio]--> Management Server --[metadata, commands]--> S3
  Chrome Extension --[screenshots, clicks]--> Packager (localhost:9222) --[ZIP package]--> S3
  Management Server <--[ZIP, metadata]-- S3
  Management Server --[audio]--> AWS Transcribe --[transcript]--> Management Server
  Management Server --[transcript + screenshots]--> Claude AI --[summary]--> Management Server
  Management Server --[summary]--> S3
```

### Communication Protocols

| From | To | Protocol | Data |
|------|----|----------|------|
| Android App | Management Server | HTTPS POST | Badge scan, session create/end, audio file |
| Chrome Extension | Packager | HTTP POST (localhost) | JPEG screenshots, click JSON |
| Packager | S3 | AWS SDK | ZIP package, package-manifest.json |
| Management Server | S3 | AWS SDK | metadata.json, commands, active-session.json |
| Packager | S3 | AWS SDK (poll) | active-session.json (read every 2s) |
| Management Server | AWS Transcribe | AWS SDK | Audio file for transcription |
| Management Server | Claude AI (RONE) | Anthropic SDK | Screenshots + transcript for analysis |

---

## 3. Component Details

### 3.1 Management Server

**What it does:** Central control plane. Manages events, badge profiles, sessions, contacts, user accounts, and coordinates the AI analysis pipeline. Serves the management web dashboard.

**Technology stack:**
- Node.js + Express.js
- SQLite via `better-sqlite3` (WAL mode)
- AWS SDK v3 (S3, Transcribe)
- Anthropic SDK (Claude AI via RONE gateway)
- `multer` for file uploads
- `helmet` for security headers
- Cookie-based auth with PBKDF2 password hashing

**Key files:**
- `management/server.js` -- Main Express app, all API routes
- `management/lib/db.js` -- SQLite schema and data access layer
- `management/lib/auth.js` -- Authentication, session tokens, user management
- `management/lib/session-analyzer.js` -- AI analysis pipeline (Transcribe + Claude)
- `management/lib/badge-trainer.js` -- Badge OCR via Claude vision
- `management/lib/contact-matcher.js` -- CSV import and AI contact matching
- `management/lib/session-importer.js` -- S3 session import (ZIP extraction)
- `management/public/` -- Web dashboard (static HTML/CSS/JS)

**How to run:**
```bash
cd management
npm install
# Set environment variables (see below)
node server.js
# Listens on port 4000 by default
```

**Environment variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server listen port |
| `S3_BUCKET` | `boothapp-sessions-752266476357` | S3 bucket for session data |
| `AWS_REGION` | `us-east-1` | AWS region |
| `MANAGEMENT_DB` | `./data/caseyapp.db` | SQLite database path |
| `MANAGEMENT_URL` | auto-detected | Public URL of management server |
| `RONE_AI_API_KEY` | -- | RONE AI gateway API key |
| `RONE_AI_BASE_URL` | -- | RONE AI gateway base URL |
| `ANTHROPIC_API_KEY` | -- | Fallback Anthropic API key |
| `ANALYSIS_MODEL` | `claude-sonnet-4-6` | Claude model for analysis |

**URL:** https://caseyapp.trendcyberrange.com

---

### 3.2 Chrome Extension

**What it does:** Runs on the demo PC browser. Captures a screenshot every second using `chrome.tabs.captureVisibleTab()`, tracks all click events via a content script, and records microphone audio via an offscreen document. Sends all data to the local Packager service.

**Technology stack:**
- Chrome Manifest V3 extension
- Service worker (background.js)
- Content script (content.js) for click tracking
- Offscreen document for microphone recording (MediaRecorder API)

**Key files:**
- `extension/manifest.json` -- Extension manifest (v3)
- `extension/background.js` -- Service worker: screenshot capture, audio control, S3 polling
- `extension/content.js` -- Content script: click event listener, DOM path extraction
- `extension/popup.html` / `popup.js` -- Extension popup UI
- `extension/offscreen.html` / `offscreen.js` -- Audio recording via offscreen document

**Permissions:**
- `activeTab`, `tabs`, `storage`
- Host permissions: `<all_urls>`

**How to install:**
1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory (or `C:\Phantom Recall\extension` on installed demo PCs)

**Screenshot format:**
- JPEG, quality 60, max 1920x1080
- Naming: `screenshot_<MM>m<SS>s<mmm>.jpg` (elapsed time from session start)
- Interval: 1 screenshot per second (configurable)
- POST to `http://localhost:9222/screenshots` with `X-Filename` header

**Click tracking:**
- Content script intercepts all click events
- Captures: DOM path, element tag/id/class/text, coordinates, page URL/title, navigation flag
- Accumulated in `clicks.json` format per the data contract
- POST to `http://localhost:9222/clicks`

---

### 3.3 Demo PC Packager

**What it does:** Runs on the demo PC as a local HTTP server. Receives screenshots and clicks from the Chrome extension, records audio via ffmpeg, packages everything into a ZIP file when the session ends, and uploads to S3.

**Technology stack:**
- Node.js (raw `http` module, no Express)
- AWS SDK v3 (S3)
- `adm-zip` for ZIP creation
- ffmpeg for audio recording (WAV capture, MP3 conversion)

**Key files:**
- `packager/server.js` -- HTTP server (port 9222)
- `packager/lib/session-manager.js` -- Session lifecycle, polling, screenshot/audio/clicks collection
- `packager/lib/audio-manager.js` -- ffmpeg-based audio recording
- `packager/lib/packager.js` -- ZIP creation and S3 upload
- `packager/recorder.html` -- Browser-based audio recorder fallback

**API endpoints (localhost:9222):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/screenshots` | Receive screenshot JPEG (binary body, X-Filename header) |
| POST | `/audio` | Receive WebM audio from extension |
| POST | `/clicks` | Receive click tracking JSON |
| POST | `/session/end` | Trigger session packaging and upload |
| GET | `/status` | Current session status (active, screenshot count, audio state) |
| GET | `/recorder` | Serve browser-based audio recorder page |

**Session lifecycle:**
1. Polls `s3://boothapp-sessions-752266476357/active-session.json` every 2 seconds
2. When a new session appears, creates local directories and starts audio recording via ffmpeg
3. Extension POSTs screenshots and clicks throughout the session
4. When `active-session.json` is deleted (session ended), stops audio, creates ZIP, uploads to S3
5. Writes `package-manifest.json` alongside the ZIP

**How to run:**
```bash
cd packager
npm install
# Requires S3_BUCKET, AWS credentials in environment
node server.js
# Listens on 127.0.0.1:9222
```

---

### 3.4 Android App

**What it does:** The SE's companion app. Scans visitor badges via camera (OCR), creates sessions on the management server, records audio from the phone microphone, and controls session lifecycle (start/end/stop-audio).

**Technology stack:**
- Android (Kotlin)
- CameraX for badge photo capture
- QR code scanning for demo PC pairing
- HTTP client for management server API calls

**Key files:**
- `android/app/src/main/AndroidManifest.xml` -- App manifest
- `android/app/src/main/java/.../ui/MainActivity.kt` -- Main activity (session control)
- `android/app/src/main/java/.../ui/SettingsActivity.kt` -- Server URL/event config
- `android/app/src/main/java/.../ui/QrScanActivity.kt` -- QR code scanner for demo PC pairing

**Permissions:**
- `CAMERA` -- Badge photo capture
- `RECORD_AUDIO` -- Session audio recording
- `INTERNET` -- API communication
- `ACCESS_NETWORK_STATE` -- Connection checks

**Activities:**
- `MainActivity` -- Main session control screen (badge scan, start/end session)
- `SettingsActivity` -- Configure management server URL and event
- `QrScanActivity` -- Scan QR code to pair with a demo PC

**How to build:**
```bash
cd android
./gradlew assembleDebug
# APK output: app/build/outputs/apk/debug/app-debug.apk
```

**Distribution:** APK is uploaded to S3 at `s3://boothapp-sessions-752266476357/demo-setup/CaseyApp.apk` for sideloading.

---

### 3.5 Presenter Server

**What it does:** Runs on the demo PC alongside the Packager. Serves the SE-facing web dashboard for session viewing, feedback forms, and session creation (web fallback when Android app is unavailable).

**Technology stack:**
- Node.js + Express.js
- AWS SDK v3 (S3)
- `express-rate-limit` (100 req/min per IP)
- Static file serving

**Key files:**
- `presenter/server.js` -- Express app (port 3000)
- `presenter/lib/sessions.js` -- S3 session listing and caching
- `presenter/lib/batch-analyze.js` -- Batch analysis trigger
- `presenter/lib/screenshots.js` -- Screenshot serving from S3
- `presenter/*.html` -- Web pages (session viewer, feedback form, share page)

**API endpoints (localhost:3000):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with uptime |
| GET | `/api/config` | Server configuration |
| GET | `/api/pages` | List available HTML pages |
| POST | `/api/create-session` | Create session (web fallback) |
| POST | `/api/end-session` | End session (web fallback) |
| POST | `/api/errors` | Log client-side errors |
| GET | `/api/errors` | Retrieve logged errors |
| GET | `/api/share/:sessionId` | Get share link for session |

---

### 3.6 Installer

**What it does:** PowerShell script that sets up a demo PC from scratch. Installs Node.js and ffmpeg, copies app code, activates with the management server via a pairing code, writes configuration, and sets up auto-start on login.

**Key files:**
- `installer/install.ps1` -- Main installer script

**Installation directory:** `C:\Phantom Recall`

**What it installs:**
1. Node.js LTS (via winget)
2. ffmpeg (via winget)
3. App components: `packager/`, `presenter/`, `extension/`, `audio/`, `infra/`
4. Brand assets (logos)
5. npm dependencies for packager and presenter

**What it configures:**
- `.env` file with S3 credentials, management URL, event/PC config
- VBS startup script in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Phantom Recall.vbs`

**Usage:**
```powershell
# Interactive (prompts for URL and code)
.\install.ps1

# Non-interactive
.\install.ps1 -ManagementUrl "https://caseyapp.trendcyberrange.com" -Code "ABC123"
```

**Post-install services:**
- Packager: `http://localhost:9222/status`
- Presenter: `http://localhost:3000`

---

## 4. Data Flow

### 4.1 Pre-Event Setup

```
1. Admin logs into management dashboard (caseyapp.trendcyberrange.com)
2. Creates an Event (e.g., "Black Hat 2026")
3. Uploads sample badge photos for the event
4. Trains a Badge Profile:
   - Uploads 2-3 sample badges
   - Claude vision extracts fields (name, company, title, etc.)
   - Admin corrects any mistakes
   - System builds an extraction prompt tuned to that badge layout
5. Links the Badge Profile to the Event
6. Generates Pairing Codes for each demo PC
7. Imports attendee CSV (contact list) for post-event matching
```

### 4.2 Demo PC Setup

```
1. Run installer on each demo PC:
   installer/install.ps1 -ManagementUrl https://caseyapp.trendcyberrange.com -Code <PAIRING_CODE>
2. Installer contacts management server with pairing code
3. Management server returns:
   - S3 credentials (from EC2 instance metadata or environment)
   - Event configuration
   - Badge field definitions
4. Installer writes .env, installs dependencies, starts services
5. Load Chrome extension (chrome://extensions > Load unpacked > C:\Phantom Recall\extension)
6. Demo PC is ready -- packager is polling S3 for active sessions
```

### 4.3 Badge Scan and Session Creation

```
1. Visitor walks up to booth
2. SE opens Android app, takes photo of visitor's badge
3. App sends badge photo to management server: POST /api/badges/scan
4. Management server runs Claude vision OCR with the event's trained badge profile
5. Claude extracts: name, company, title, email (field confidence scores included)
6. App displays extracted fields for SE to confirm/correct
7. SE taps "Start Session"
8. App calls: POST /api/sessions/create
   Body: { event_id, visitor_name, visitor_company, demo_pc, se_name, ... }
9. Management server:
   a. Generates session ID (8-char alphanumeric, e.g., "A726594B")
   b. Writes to S3:
      - sessions/<id>/metadata.json (visitor info, timestamps)
      - sessions/<id>/state.json (lifecycle tracking)
      - commands/<demo_pc>/start.json (start signal)
      - active-session.json (global active session flag)
   c. Creates contact record in SQLite DB
   d. Auto-links session to contact
```

### 4.4 During the Demo -- Capture

```
1. Packager on demo PC detects new active-session.json (polling every 2s)
2. Packager creates local session directory: sessions/<id>/screenshots/
3. Packager starts audio recording via ffmpeg (44100Hz stereo WAV)
4. Chrome extension detects session is active
5. Extension begins:
   a. Screenshot capture: chrome.tabs.captureVisibleTab() every 1 second
      - POST to http://localhost:9222/screenshots
      - Named: screenshot_00m00s000.jpg, screenshot_00m01s012.jpg, ...
   b. Click tracking: content script captures all clicks
      - DOM path, element details, coordinates, page URL/title
      - POST to http://localhost:9222/clicks
6. If visitor opts out of audio:
   a. SE taps "Stop Audio" in app
   b. App calls: POST /api/sessions/<id>/stop-audio
   c. Management server writes sessions/<id>/commands/stop-audio to S3
   d. Management server updates active-session.json with stop_audio: true
   e. Packager detects stop_audio flag, stops ffmpeg recording
   f. Screenshot capture continues
```

### 4.5 Session End -- Packaging and Upload

```
1. SE taps "End Session" in Android app
2. App calls: POST /api/sessions/<id>/end
3. Management server:
   a. Updates metadata.json with ended_at timestamp and status: "completed"
   b. Writes commands/<demo_pc>/end.json
   c. Deletes active-session.json
4. Packager detects active-session.json is gone
5. Packager stops audio recording
6. Packager creates ZIP:
   - screenshots/*.jpg (all captured screenshots)
   - audio/recording.mp3 (converted from WAV, VBR quality 2) -- or absent if audio opted out
   - clicks/clicks.json
7. ZIP named: <Visitor_Name>_<session_id>.zip (e.g., Joel_Ginsberg_A726594B.zip)
8. Packager uploads to S3:
   - sessions/<id>/<Visitor_Name>_<session_id>.zip
   - sessions/<id>/package-manifest.json
9. Phone uploads audio recording (m4a from phone mic) separately:
   - POST /api/sessions/<id>/audio (multipart file upload)
   - Management server uploads to sessions/<id>/audio/recording.m4a in S3
```

### 4.6 Import, Transcription, and AI Analysis

```
1. After session end, management server waits 15 seconds for uploads to finish
2. Auto-import triggers (retries up to 6 times, 30s total):
   a. Lists S3 session contents
   b. Downloads and extracts ZIP to management/data/sessions/<id>/
   c. Downloads audio files from S3 (checks m4a, wav, mp3, webm)
   d. Counts screenshots, records metadata in SQLite
   e. Sets session status to "imported"
3. If screenshots found, AI analysis begins:
   a. Sample up to 15 screenshots evenly across the session (base64 encoded)
   b. Load click tracking summary (first 30 clicks as text)
   c. If audio exists and under 25MB:
      - Upload audio to S3 for AWS Transcribe
      - Start transcription job (en-US, MP4 format)
      - Poll every 5s for completion (up to 5 minutes)
      - Download transcript text
   d. Build Claude API request:
      - System prompt: demo session analysis instructions
      - Content: transcript text + sampled screenshots (as images) + click summary + metadata
   e. Claude model (default: claude-sonnet-4-6) generates structured summary:
      - VISITOR, COMPANY, ROLE
      - DEMO SUMMARY (products/features demonstrated)
      - CONVERSATION SUMMARY (key discussion points)
      - KEY INTERESTS (with evidence)
      - RECOMMENDED FOLLOW-UP (next steps)
   f. If no transcript available, note is appended to summary
4. Summary saved to management/data/sessions/<id>/summary.txt
5. Summary uploaded to S3: sessions/<id>/output/summary.txt
6. Session status updated to "analyzed"
```

### 4.7 Post-Event -- Contact Matching and Review

```
1. Admin imports attendee CSV: POST /api/contacts/import-csv
   - Auto-detects column mappings (name, email, company, title, phone, etc.)
   - Handles common header variations (e.g., "First Name", "firstname", "fname")
2. Admin triggers AI contact matching: POST /api/contacts/match
   - For each unmatched session, Claude compares visitor name/company against contact list
   - Handles OCR typos, name variations, company abbreviations
   - Assigns confidence scores (0.0-1.0)
   - Links sessions to contacts in session_contacts table
3. SDR team reviews sessions in management dashboard:
   - View AI-generated summaries
   - See matched contact details
   - View captured screenshots
   - Listen to audio recordings
   - Manually link sessions to contacts if needed
```

---

## 5. Database Schema

SQLite database at `management/data/caseyapp.db` (WAL mode, foreign keys enabled).

### users

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| username | TEXT UNIQUE | Login username |
| password_hash | TEXT | PBKDF2 hash (salt:hash format) |
| display_name | TEXT | Display name (default: username) |
| role | TEXT | `admin` or `user` (default: `user`) |
| must_change_password | INTEGER | 1 = must change on next login |
| created_at | TEXT | ISO-8601 timestamp |

### auth_sessions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| token | TEXT UNIQUE | 32-byte hex session token |
| user_id | INTEGER FK | References users(id) |
| expires_at | TEXT | ISO-8601 expiry (24h from creation) |
| created_at | TEXT | ISO-8601 timestamp |

### events

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Event name (e.g., "Black Hat 2026") |
| date | TEXT | Event date |
| location | TEXT | Event location |
| badge_profile_id | INTEGER | Linked badge profile for OCR |
| active | INTEGER | 1 = currently active event |
| created_at | TEXT | ISO-8601 timestamp |

### badge_profiles

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| event_id | INTEGER | Associated event |
| name | TEXT | Profile name |
| field_mappings | TEXT | JSON array of field type/position/label mappings |
| extraction_prompt | TEXT | AI prompt tuned from corrections |
| sample_images | TEXT | JSON array of sample image references |
| sample_corrections | TEXT | JSON array of human corrections for training |
| created_at | TEXT | ISO-8601 timestamp |

### demo_pcs

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| event_id | INTEGER | Associated event |
| name | TEXT | Demo PC identifier (e.g., "booth-pc-1") |
| registered_at | TEXT | ISO-8601 timestamp |
| UNIQUE(event_id, name) | | |

### sessions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| session_id | TEXT UNIQUE | 8-char alphanumeric ID |
| event_id | INTEGER FK | References events(id) |
| visitor_name | TEXT | Visitor name from badge scan |
| visitor_company | TEXT | Company name |
| visitor_title | TEXT | Job title |
| visitor_email | TEXT | Email address |
| visitor_phone | TEXT | Phone number |
| demo_pc | TEXT | Demo PC used |
| se_name | TEXT | Sales Engineer name |
| status | TEXT | `active`, `completed`, `imported`, `analyzed` |
| zip_key | TEXT | S3 key of uploaded ZIP |
| screenshot_count | INTEGER | Number of screenshots captured |
| has_audio | INTEGER | 1 if audio recording exists |
| audio_opted_out | INTEGER | 1 if visitor opted out of audio |
| local_path | TEXT | Local filesystem path to extracted session |
| created_at | TEXT | ISO-8601 timestamp |
| imported_at | TEXT | When session was imported from S3 |

### contacts

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| event_id | INTEGER FK | References events(id) |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| email | TEXT | Email address |
| company | TEXT | Company name |
| title | TEXT | Job title |
| phone | TEXT | Phone number |
| address | TEXT | Street address |
| city | TEXT | City |
| state | TEXT | State/province |
| zip | TEXT | Postal/ZIP code |
| country | TEXT | Country |
| lead_score | TEXT | Lead score or rating |
| source | TEXT | `csv`, `badge-scan`, or other |
| raw_csv_row | TEXT | Full original CSV row as JSON |
| imported_at | TEXT | ISO-8601 timestamp |

### session_contacts

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | References sessions(session_id) |
| contact_id | INTEGER FK | References contacts(id) |
| match_confidence | REAL | 0.0 to 1.0 confidence score |
| match_method | TEXT | `ai`, `badge-scan`, `manual`, `generated` |
| match_reasoning | TEXT | AI explanation or manual note |
| matched_at | TEXT | ISO-8601 timestamp |
| UNIQUE(session_id, contact_id) | | |

### pairing_codes (created on first use)

| Column | Type | Description |
|--------|------|-------------|
| code | TEXT PK | 6-char uppercase pairing code |
| event_id | INTEGER | Associated event |
| demo_pc_name | TEXT | Target demo PC name |
| expires_at | TEXT | ISO-8601 expiry (1 hour) |
| used | INTEGER | 1 if code has been consumed |
| created_at | TEXT | ISO-8601 timestamp |

---

## 6. API Reference

Base URL: `https://caseyapp.trendcyberrange.com`

All endpoints return JSON. Authentication is via `phantomrecall_token` cookie or `X-Auth-Token` header, unless noted as public.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login with username/password. Sets cookie. |
| POST | `/api/auth/logout` | Public | Clear session token and cookie. |
| POST | `/api/auth/change-password` | Authenticated | Change password. Body: `{ current_password, new_password }` |
| GET | `/api/auth/me` | Authenticated | Get current user info and must_change_password flag. |

### User Management (admin only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Admin | List all users. |
| POST | `/api/users` | Admin | Create user. Body: `{ username, password, display_name, role }` |
| PUT | `/api/users/:id` | Admin | Update user (display_name, role). |
| DELETE | `/api/users/:id` | Admin | Delete user (cannot delete self). |
| POST | `/api/users/:id/reset-password` | Admin | Reset password. Body: `{ password }`. Forces change on next login. |

### Events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events` | Authenticated | List all events with session counts. |
| POST | `/api/events` | Authenticated | Create event. Body: `{ name, date, location }` |
| GET | `/api/events/:id` | Authenticated | Get event details. |
| PUT | `/api/events/:id` | Authenticated | Update event fields. |
| DELETE | `/api/events/:id` | Authenticated | Delete event. |
| POST | `/api/events/:id/activate` | Authenticated | Set as active event (deactivates others). |
| GET | `/api/events/:id/config` | Authenticated | Full event config: badge profile, fields, demo PCs. |

### Badge Training

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/badges/upload` | Authenticated | Upload badge sample image. Multipart: `badge` field. |
| POST | `/api/badges/analyze` | Authenticated | Analyze badge with optional profile. Multipart: `badge` field + `profile_id`. |
| POST | `/api/badges/train` | Authenticated | Create badge profile. Body: `{ event_id, name, field_mappings, sample_corrections }` |
| GET | `/api/badges/profiles` | Authenticated | List profiles. Optional query: `event_id`. |
| GET | `/api/badges/profiles/:id` | Authenticated | Get profile details. |
| POST | `/api/badges/test` | Authenticated | Test badge against profile. Multipart: `badge` + `profile_id`. |
| POST | `/api/badges/scan` | Public | Scan badge for session creation. Multipart: `badge` + `event_id`. Returns extracted fields. |

### Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sessions` | Authenticated | List sessions. Optional query: `event_id`. |
| GET | `/api/sessions/:id` | Authenticated | Get session details with contact matches. |
| POST | `/api/sessions/create` | Authenticated | Create session. Body: `{ event_id, visitor_name, demo_pc, se_name, ... }` |
| POST | `/api/sessions/:id/end` | Authenticated | End session. Triggers auto-import and analysis after 15s. |
| POST | `/api/sessions/:id/stop-audio` | Authenticated | Stop audio recording mid-session. |
| POST | `/api/sessions/:id/audio` | Authenticated | Upload audio file from phone. Multipart: `audio` field (max 200MB). |
| POST | `/api/sessions/:id/analyze` | Authenticated | Trigger AI analysis (async). |
| GET | `/api/sessions/:id/summary` | Authenticated | Get analysis summary text. |
| GET | `/api/sessions/:id/screenshots` | Authenticated | List screenshot filenames. |
| GET | `/api/sessions/:id/screenshots/:filename` | Authenticated | Serve screenshot image file. |
| GET | `/api/sessions/:id/audio/:filename` | Authenticated | Serve audio file. |
| GET | `/api/sessions/active` | Authenticated | Poll for active session (reads active-session.json from S3). |
| POST | `/api/sessions/import` | Authenticated | Import single session from S3. Body: `{ session_id, event_id }` |
| POST | `/api/sessions/import-all` | Authenticated | Import all unimported sessions from S3. Body: `{ event_id }` |
| DELETE | `/api/sessions/:id` | Authenticated | Delete session (S3 + DB + local files). |
| POST | `/api/sessions/clear-all` | Authenticated | Delete all sessions (S3 + DB). |
| POST | `/api/sessions/generate-fake` | Authenticated | Generate test sessions for unmatched contacts. Body: `{ count, event_id }` |

### Contacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/contacts` | Authenticated | List contacts. Query: `event_id, search, limit, offset`. |
| GET | `/api/contacts/:id` | Authenticated | Get contact details with matched sessions. |
| POST | `/api/contacts/import-csv` | Authenticated | Import contacts from CSV. Multipart: `csv` field + `event_id`. |
| POST | `/api/contacts/match` | Authenticated | AI-match unmatched sessions to contacts. Body: `{ event_id }` |
| PUT | `/api/contacts/:id/session` | Authenticated | Manually link contact to session. Body: `{ session_id }` |

### Demo PC Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/demo-pcs` | Authenticated | List demo PCs. Optional query: `event_id`. |
| POST | `/api/demo-pcs/register` | Public | Register demo PC (returns S3 creds + event config). Body: `{ event_id, demo_pc_name }` |
| POST | `/api/demo-pcs/pairing-code` | Admin | Generate pairing code. Body: `{ event_id, demo_pc_name }`. Returns 6-char code valid 1 hour. |
| POST | `/api/demo-pcs/activate` | Public | Activate demo PC with pairing code. Body: `{ code }`. Returns S3 creds + full config. |
| GET | `/api/demo-pcs/:id/qr-payload` | Authenticated | QR code JSON payload for Android app pairing. |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Health check. Returns `{ status: "ok", service, version }`. |
| GET | `/api/config` | Authenticated | Server config: S3 bucket, active event, AI model. |

---

## 7. S3 Data Structure

**Bucket:** `boothapp-sessions-752266476357`
**Region:** `us-east-1`

### Session Data

```
sessions/<session-id>/
  metadata.json                           # Visitor info, timestamps, demo PC, SE name
  badge.jpg                               # Badge photo (from Android app)
  state.json                              # Session state machine history
  <Visitor_Name>_<session_id>.zip         # Packaged session artifacts
  package-manifest.json                   # ZIP metadata (size, counts, flags)
  commands/
    stop-audio                            # Presence = audio stop requested
  audio/
    recording.m4a                         # Audio from phone (uploaded separately)
    recording.wav                         # Audio from demo PC ffmpeg (inside ZIP)
    recording.mp3                         # Converted audio (inside ZIP)
  transcript/
    transcribe-output.json                # AWS Transcribe result
  clicks/
    clicks.json                           # Click tracking data
  screenshots/
    screenshot_00m00s000.jpg              # Screenshots by elapsed time
    screenshot_00m01s012.jpg
    ...
  output/
    summary.txt                           # AI-generated analysis summary
    summary.json                          # Structured summary (when available)
    follow-up.json                        # Follow-up actions
```

### ZIP Package Contents

```
<Visitor_Name>_<session_id>.zip
  screenshots/
    screenshot_00m00s000.jpg
    screenshot_00m01s012.jpg
    ...
  audio/
    recording.mp3                         # Absent if audio opted out
  clicks/
    clicks.json
```

### Command Files

```
commands/<demo_pc>/
  start.json                              # Session start signal for demo PC
  end.json                                # Session end signal for demo PC
```

### Global State

```
active-session.json                       # Currently active session (deleted when session ends)
```

### Deploy Artifacts

```
demo-setup/
  caseyapp-demo.zip                       # Latest management server code archive
  CaseyApp.apk                           # Android app APK
```

### Key Schemas

**metadata.json:**
```json
{
  "session_id": "A726594B",
  "visitor_name": "Joel Ginsberg",
  "visitor_company": "Acme Corp",
  "visitor_title": "CISO",
  "visitor_email": "joel@example.com",
  "badge_photo": "badge.jpg",
  "started_at": "2026-08-05T14:32:00Z",
  "ended_at": "2026-08-05T14:47:00Z",
  "demo_pc": "booth-pc-3",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed"
}
```

**active-session.json:**
```json
{
  "session_id": "A726594B",
  "active": true,
  "started_at": "2026-08-05T14:32:00Z",
  "visitor_name": "Joel Ginsberg",
  "stop_audio": false
}
```

**package-manifest.json:**
```json
{
  "session_id": "A726594B",
  "visitor_name": "Joel Ginsberg",
  "zip_key": "sessions/A726594B/Joel_Ginsberg_A726594B.zip",
  "zip_size_bytes": 52428800,
  "screenshot_count": 300,
  "has_audio": true,
  "has_clicks": true,
  "audio_opted_out": false,
  "created_at": "2026-04-01T14:30:00.000Z"
}
```

---

## 8. Authentication

### Overview

The management server uses cookie-based authentication with PBKDF2 password hashing. Session tokens are stored in SQLite and expire after 24 hours.

### How It Works

1. User sends POST `/api/auth/login` with `{ username, password }`
2. Server verifies password against PBKDF2 hash (100,000 iterations, SHA-512, 16-byte salt)
3. On success, generates a 32-byte random hex token
4. Token stored in `auth_sessions` table with 24-hour expiry
5. Token set as `phantomrecall_token` cookie (httpOnly, secure on HTTPS, sameSite=lax)
6. Subsequent requests authenticate via:
   - Cookie: `phantomrecall_token`
   - Header: `X-Auth-Token` (for API clients)

### Default Credentials

On first startup, the server seeds a default admin account:
- **Username:** `admin`
- **Password:** `admin`
- **Must change password:** Yes (forced on first login)

### Password Requirements

- Minimum 6 characters
- Changed via POST `/api/auth/change-password`
- Admin can force password reset via POST `/api/users/:id/reset-password` (sets `must_change_password = 1`)

### Forced Password Change

When `must_change_password` is set:
- API requests return 403 with `{ error: "Password change required", must_change_password: true }`
- Web requests redirect to `/change-password.html`
- Only password change and logout endpoints are accessible

### Public Endpoints (no auth required)

- `POST /api/auth/login`
- `GET /api/health`
- `POST /api/demo-pcs/activate`
- `POST /api/demo-pcs/register`
- `POST /api/badges/scan`
- Paths starting with: `/api/sessions/`, `/api/events`, `/login.html`, `/styles.css`, `/brand/`, `/favicon.ico`

### Session Cleanup

Expired auth sessions are cleaned from the database every hour via `setInterval`.

### Roles

| Role | Capabilities |
|------|-------------|
| `admin` | Full access: user management, pairing code generation, all endpoints |
| `user` | Standard access: sessions, events, badges, contacts (no user management) |

---

## 9. Deployment

### 9.1 Management Server (EC2)

**Host:** `caseyapp.trendcyberrange.com` (34.239.159.231)
**Instance:** t3.small, Amazon Linux 2023
**SSH Key:** `~/.ssh/caseyapp-demo-key.pem`

**Server layout:**
```
/home/caseyapp/
  app/                    # Application code (replaced on deploy)
    management/
      server.js
      lib/
      public/
      data -> /home/caseyapp/data   # Symlink to persistent data
  data/                   # Persistent data (NEVER deleted on deploy)
    caseyapp.db           # SQLite database
    caseyapp.db-wal
    sessions/             # Imported session files
    badge-samples/        # Uploaded badge images
    uploads/              # CSV uploads
    audio-uploads/        # Audio file uploads
```

**System service:** `caseyapp-management` (systemd)
- Runs on port 4000
- nginx reverse proxy on ports 80/443 with SSL

**Deploy process (`scripts/deploy-management.sh`):**
1. `git archive` creates a ZIP of HEAD
2. ZIP uploaded to S3: `demo-setup/caseyapp-demo.zip`
3. SSH to server:
   - Backup `.env`
   - Migrate DB from old location if needed
   - Stop systemd service
   - Download ZIP from S3, extract to `/home/caseyapp/app/`
   - Restore `.env`
   - Symlink `management/data` -> `/home/caseyapp/data` (persistent)
   - `npm install --production`
   - Start systemd service
   - Verify health check

**Deploy command:**
```bash
./scripts/deploy-management.sh
```

**Required `.env` on server:**
```
RONE_AI_API_KEY=<rone-gateway-key>
RONE_AI_BASE_URL=<rone-gateway-url>
S3_BUCKET=boothapp-sessions-752266476357
AWS_REGION=us-east-1
MANAGEMENT_URL=https://caseyapp.trendcyberrange.com
```

AWS credentials come from the EC2 instance IAM role (`caseyapp-management-role`), not from environment variables.

### 9.2 Demo PC Setup

1. Ensure Windows 11 Pro with internet access
2. Open PowerShell as Administrator
3. Run the installer:
   ```powershell
   .\installer\install.ps1
   ```
4. Enter the management server URL: `https://caseyapp.trendcyberrange.com`
5. Enter the pairing code (generated from management dashboard)
6. Wait for installation to complete (~2-3 minutes)
7. Load Chrome extension:
   - Open Chrome > `chrome://extensions`
   - Enable Developer mode
   - Load unpacked > `C:\Phantom Recall\extension`
8. Verify services:
   - Packager: `http://localhost:9222/status`
   - Presenter: `http://localhost:3000`

Services auto-start on Windows login via VBS script in Startup folder.

### 9.3 Android App

**Build:**
```bash
cd android
./gradlew assembleDebug
```

**APK location:** `android/app/build/outputs/apk/debug/app-debug.apk`

**Distribution:**
- Upload to S3: `s3://boothapp-sessions-752266476357/demo-setup/CaseyApp.apk`
- Sideload onto SE phones (enable "Install from unknown sources")

**Configuration (in-app):**
- Settings > Management Server URL: `https://caseyapp.trendcyberrange.com`
- Pair with demo PC: scan QR code from management dashboard

### 9.4 Chrome Extension

The extension is loaded as an unpacked extension (not published to Chrome Web Store).

**Installation:**
1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select `C:\Phantom Recall\extension` (on installed demo PCs) or `extension/` (from repo)

**The extension icon appears in the Chrome toolbar. Click it to see session status.**

---

## 10. AWS Resources

**AWS Account:** 752266476357
**Region:** us-east-1
**Cleanup Tag:** `boothapp-cleanup=demo-2026-04-01`

### Resource Inventory

| Resource | ID/Name | Details |
|----------|---------|---------|
| EC2 Instance | `i-058a9f7e7e80ac777` | t3.small, Amazon Linux 2023, `caseyapp-management` |
| Public IP | 34.239.159.231 | Elastic IP for management server |
| DNS | caseyapp.trendcyberrange.com | A record -> 34.239.159.231 |
| Route53 Zone | Z08962549NVDQ5V5JIWS | trendcyberrange.com |
| S3 Bucket | boothapp-sessions-752266476357 | Session data, deploy artifacts |
| Security Group | sg-0e4794b565ccf4c57 | `caseyapp-management` -- ports 22, 80, 443 |
| Security Group | sg-0a2d74c0aec3543b2 | `caseyapp-demo-rdp` -- ports 3389, 3000, 9222 |
| IAM Role | caseyapp-management-role | EC2 instance role |
| Instance Profile | caseyapp-management-profile | Attached to EC2 instance |
| IAM Policy | AmazonS3FullAccess | Attached to role |
| Key Pair | caseyapp-demo-key | SSH key for EC2 access |
| Demo PC Instance | `i-078e20cb0b73776bd` | `boothapp-demo-windows` (pre-existing, may not be needed) |

### S3 Bucket Contents

| Prefix | Contents |
|--------|----------|
| `sessions/` | All session data (metadata, ZIPs, screenshots, audio, summaries) |
| `commands/` | Demo PC start/end signals |
| `demo-setup/` | Deploy artifacts (caseyapp-demo.zip, CaseyApp.apk) |
| `active-session.json` | Currently active session (root level) |

### Cleanup Commands

To tear down all AWS resources after the event:

```bash
# Terminate EC2 instances
aws ec2 terminate-instances --instance-ids i-058a9f7e7e80ac777 --region us-east-1

# Delete security groups (after instance termination)
aws ec2 delete-security-group --group-id sg-0e4794b565ccf4c57 --region us-east-1
aws ec2 delete-security-group --group-id sg-0a2d74c0aec3543b2 --region us-east-1

# Delete key pair
aws ec2 delete-key-pair --key-name caseyapp-demo-key --region us-east-1

# Clean up IAM
aws iam remove-role-from-instance-profile \
  --instance-profile-name caseyapp-management-profile \
  --role-name caseyapp-management-role --region us-east-1
aws iam delete-instance-profile \
  --instance-profile-name caseyapp-management-profile --region us-east-1
aws iam detach-role-policy \
  --role-name caseyapp-management-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess --region us-east-1
aws iam delete-role --role-name caseyapp-management-role --region us-east-1

# Delete DNS record
aws route53 change-resource-record-sets --hosted-zone-id Z08962549NVDQ5V5JIWS \
  --change-batch '{"Changes":[{"Action":"DELETE","ResourceRecordSet":{"Name":"caseyapp.trendcyberrange.com","Type":"A","TTL":60,"ResourceRecords":[{"Value":"34.239.159.231"}]}}]}'

# Clean deploy artifacts from S3
aws s3 rm s3://boothapp-sessions-752266476357/demo-setup/ --recursive --region us-east-1
```

Note: The S3 bucket itself and session data are not deleted by the cleanup commands above. Delete the bucket manually if no longer needed:
```bash
aws s3 rb s3://boothapp-sessions-752266476357 --force --region us-east-1
```


## 11. Troubleshooting

### Management Server

**Server won't start:**
- Check `.env` exists at `management/.env` with required variables
- Verify SQLite DB directory is writable: `management/data/` (or symlinked `/home/caseyapp/data/`)
- Check port 4000 is not in use: `lsof -i :4000`
- Review logs: `journalctl -u caseyapp-management -n 50`

**"Authentication required" on all endpoints:**
- Default credentials: `admin` / `admin`
- If locked out, delete `caseyapp.db` to reset (loses all data) or manually update the database

**AI analysis returns no summary:**
- Check `RONE_AI_API_KEY` and `RONE_AI_BASE_URL` are set in `.env`
- Verify the session has screenshots: `GET /api/sessions/<id>/screenshots`
- Check audio file size (must be under 25MB for Claude)
- Check AWS Transcribe permissions (IAM role needs transcribe:StartTranscriptionJob)
- Review server logs for `[analyzer]` messages

**Session import fails:**
- Verify AWS credentials: instance metadata or env vars
- Check S3 bucket name matches: `boothapp-sessions-752266476357`
- Verify session folder exists in S3: `aws s3 ls s3://boothapp-sessions-752266476357/sessions/<id>/`
- Check disk space for extracted session files

**Contact CSV import issues:**
- BOM characters are automatically stripped
- Headers are case-insensitive and support common variations
- If columns are not detected, check the column name against supported mappings in `contact-matcher.js`

### Demo PC / Packager

**Packager won't start:**
- Check Node.js is installed: `node --version`
- Check port 9222 is free: `netstat -an | findstr 9222`
- Verify `.env` has S3 credentials
- Check logs at `C:\Phantom Recall\logs\packager.log`

**Packager not detecting sessions:**
- Verify S3 credentials are valid (not expired session tokens)
- Check `active-session.json` exists in S3: `aws s3 ls s3://boothapp-sessions-752266476357/active-session.json`
- Packager polls every 2 seconds -- check for S3 permission errors in logs

**No audio recording:**
- ffmpeg must be installed and in PATH
- Check microphone is connected and recognized by Windows
- Verify `ffmpeg -list_devices true -f dshow -i dummy` shows audio devices
- Audio recording is optional -- session continues without it

**Screenshots not being captured:**
- Chrome extension must be loaded and enabled
- Check extension popup for status
- Verify packager is running: `http://localhost:9222/status`
- Extension requires active tab permission

**ZIP upload fails:**
- Check S3 credentials in `.env` (session tokens expire)
- Re-run pairing to get fresh credentials
- Check disk space for local session files in `C:\Phantom Recall\packager\sessions\`

### Chrome Extension

**Extension not capturing:**
- Ensure the extension is enabled in `chrome://extensions`
- Check for errors in the extension's service worker console (click "Inspect views: service worker" in chrome://extensions)
- Verify packager is running at `localhost:9222`

**Audio not working in extension:**
- Offscreen document may have failed to create -- check service worker console
- Browser may not have microphone permission -- check `chrome://settings/content/microphone`
- Only one offscreen document can exist at a time

### Android App

**Badge scan returns wrong fields:**
- Train a badge profile for the specific event's badge design
- Upload 2-3 sample badges and correct any misidentified fields
- More corrections improve extraction accuracy

**Cannot connect to management server:**
- Verify URL in Settings (must include `https://`)
- Check phone is on a network that can reach the server
- Network security config allows cleartext for development (`network_security_config.xml`)

**Audio upload fails:**
- File size limit is 200MB
- Supported formats: m4a, wav, mp3, webm
- Check network connectivity -- upload happens when session ends

### AWS / S3

**"Access Denied" errors:**
- EC2 instance: verify IAM role `caseyapp-management-role` is attached
- Demo PC: pairing code credentials may have expired -- re-pair
- Check the IAM role has `AmazonS3FullAccess` policy

**AWS Transcribe failures:**
- Job name must be unique -- includes timestamp to prevent collisions
- Audio must be in S3 (same bucket) for Transcribe to access
- Check output key path is writable
- Transcription polls for up to 5 minutes before timing out

### Deployment

**Deploy script fails at SSH step:**
- Verify SSH key exists: `~/.ssh/caseyapp-demo-key.pem`
- Key permissions: `chmod 600 ~/.ssh/caseyapp-demo-key.pem`
- Security group `sg-0e4794b565ccf4c57` must allow SSH (port 22) from your IP

**Server not accessible after deploy:**
- Check systemd service: `sudo systemctl status caseyapp-management`
- Check nginx: `sudo systemctl status nginx`
- Verify health endpoint: `curl http://localhost:4000/api/health`
- Check nginx config passes to port 4000

**Installer fails on demo PC:**
- Requires internet access for winget (Node.js, ffmpeg)
- Requires PowerShell execution policy: `Set-ExecutionPolicy -Scope Process Bypass`
- Pairing codes expire after 1 hour -- generate a fresh one if needed
