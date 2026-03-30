# S3 Session Data Contract

Authoritative reference for every file in a session folder. All workstreams
(App, Extension, Audio, Analysis, Orchestrator) communicate exclusively through
this S3 structure. No direct inter-component dependencies.

## Folder Layout

```
sessions/<session-id>/
  metadata.json
  badge.jpg
  audio/
    recording.wav
  transcript/
    transcript.json
  clicks/
    clicks.json
  screenshots/
    click-001.jpg
    click-002.jpg
    ...
  commands/
    start.json
    end.json
  output/
    summary.json
    summary.html
  v1-tenant/
    tenant.json
```

---

## File Reference

### `metadata.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Session orchestrator Lambda (`infra/session-orchestrator/orchestrator.js`) |
| **When** | Immediately on session creation (badge photo taken in Android app) |
| **Updated** | On session end (status -> `ended`, `ended_at` set); by analysis pipeline (`analyzing`, `complete`) |
| **IAM writer** | `boothapp-app-role` (create), analysis role (status updates) |

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | 6-10 char alphanumeric, e.g. `A726594` |
| `visitor_name` | string | OCR'd from badge photo, or `"Unknown"` |
| `badge_photo` | string\|null | Relative key `badge.jpg`, or null if no photo |
| `started_at` | string | ISO-8601 UTC timestamp |
| `ended_at` | string\|null | ISO-8601 UTC timestamp, null while active |
| `demo_pc` | string | Unique demo PC identifier, e.g. `booth-pc-3` |
| `se_name` | string\|null | Name of the SE running the demo |
| `audio_consent` | boolean | Whether visitor consented to audio recording |
| `status` | string | `active` -> `ended` -> `analyzing` -> `complete` |
| `upload_complete` | boolean | Set to true when demo PC finishes uploading |

---

### `badge.jpg`

| Attribute | Value |
|-----------|-------|
| **Created by** | Android app |
| **When** | Visitor badge photo captured at booth |
| **IAM writer** | `boothapp-app-role` |

JPEG image of the visitor's conference badge. Used as input for OCR to extract
visitor name. No fixed schema -- raw image bytes.

---

### `audio/recording.wav`

| Attribute | Value |
|-----------|-------|
| **Created by** | Audio capture service on demo PC (`audio/` workstream) |
| **When** | Uploaded after session ends (demo PC receives end command) |
| **IAM writer** | `boothapp-audio-role` |

WAV audio, 44100 Hz, stereo. Full recording of the demo conversation.
Duration typically 5-30 minutes.

---

### `transcript/transcript.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Audio workstream transcription step (`audio/lib/`) |
| **When** | After `recording.wav` is uploaded and transcribed (AWS Transcribe or Whisper) |
| **IAM writer** | `boothapp-audio-role` |

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Matches parent session |
| `source` | string | `"recording.wav"` |
| `duration_seconds` | number | Total audio length |
| `entries` | array | Timestamped speaker segments |
| `entries[].timestamp` | string | `"HH:MM:SS.mmm"` offset from start |
| `entries[].speaker` | string | `"SE"` or `"Visitor"` |
| `entries[].text` | string | Transcribed speech |

---

### `clicks/clicks.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Chrome extension (`extension/content.js` + `extension/background.js`) |
| **When** | Continuously during session (batched uploads); final flush on session end |
| **IAM writer** | `boothapp-extension-role` |

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Matches parent session |
| `events` | array | Click/navigation events in chronological order |
| `events[].index` | number | 1-based sequential index |
| `events[].timestamp` | string | ISO-8601 UTC |
| `events[].type` | string | `"click"` |
| `events[].dom_path` | string | CSS selector path to clicked element |
| `events[].element.tag` | string | HTML tag name |
| `events[].element.id` | string | Element ID |
| `events[].element.class` | string | CSS class(es) |
| `events[].element.text` | string | Visible text content |
| `events[].element.href` | string | Link href if applicable |
| `events[].coordinates` | object | `{ x, y }` click position |
| `events[].page_url` | string | Full page URL at time of click |
| `events[].page_title` | string | Document title |
| `events[].screenshot_file` | string | Relative path, e.g. `screenshots/click-001.jpg` |

---

### `screenshots/click-NNN.jpg`

| Attribute | Value |
|-----------|-------|
| **Created by** | Chrome extension (`extension/background.js`) |
| **When** | On each click event (one screenshot per click); also periodic captures every N seconds |
| **IAM writer** | `boothapp-extension-role` |

JPEG screenshots, quality 60, max 1920x1080. Naming convention:

- `click-001.jpg`, `click-002.jpg`, ... -- captured on click events
- `periodic-001.jpg`, `periodic-002.jpg`, ... -- captured at timed intervals

Referenced by `clicks.json` `screenshot_file` field.

---

### `commands/start.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Session orchestrator Lambda (`orchestrator.js` `createSession()`) |
| **When** | Immediately after `metadata.json` is written |
| **IAM writer** | `boothapp-app-role` |
| **S3 path** | `commands/<demo_pc>/start.json` (NOT inside `sessions/<id>/`) |

Presence of this file is the start signal. Demo PCs poll `commands/<demo_pc>/`
every 1 second for this file.

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session to start recording for |
| `demo_pc` | string | Target demo PC identifier |
| `started_at` | string | ISO-8601 UTC timestamp |
| `tenant_available` | boolean | Whether a V1 tenant was claimed for this session |

**Note:** This file lives at `commands/<demo_pc>/start.json`, not under
`sessions/<id>/`. The demo PC does not yet know the session ID -- it discovers
it by reading this file.

---

### `commands/end.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Session orchestrator Lambda (`orchestrator.js` `endSession()`) |
| **When** | When SE taps "End Session" in Android app |
| **IAM writer** | `boothapp-app-role` |
| **S3 path** | `commands/<demo_pc>/end.json` (NOT inside `sessions/<id>/`) |

Presence of this file is the end signal. Demo PCs poll `commands/<demo_pc>/`
every 5 seconds for this file.

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session to stop recording for |
| `demo_pc` | string | Target demo PC identifier |
| `ended_at` | string | ISO-8601 UTC timestamp |

---

### `output/summary.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Analysis pipeline (`analysis/engines/analyzer.py` via `analysis/analyze.py`) |
| **When** | After Claude two-pass analysis completes (all session files must be present) |
| **IAM writer** | `boothapp-analysis-role` |

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Matches parent session |
| `visitor_name` | string | From metadata |
| `demo_duration_minutes` | number | Calculated from `started_at` / `ended_at` |
| `products_shown` | string[] | V1 product areas demonstrated |
| `visitor_interests` | array | Topics the visitor showed interest in |
| `visitor_interests[].topic` | string | Interest area |
| `visitor_interests[].confidence` | string | `"high"`, `"medium"`, `"low"` |
| `visitor_interests[].evidence` | string | What indicates this interest |
| `recommended_follow_up` | string[] | Suggested next actions for SDR |
| `key_moments` | array | Notable moments during the demo |
| `key_moments[].timestamp` | string | `"HH:MM:SS"` offset |
| `key_moments[].screenshot` | string | Screenshot filename, e.g. `click-012.jpg` |
| `key_moments[].description` | string | What happened at this moment |
| `v1_tenant_link` | string | URL to the visitor's preserved V1 tenant |
| `generated_at` | string | ISO-8601 UTC timestamp |

---

### `output/summary.html`

| Attribute | Value |
|-----------|-------|
| **Created by** | Report renderer (`analysis/render-report.js`) |
| **When** | After `summary.json` and `follow-up.json` are written |
| **IAM writer** | `boothapp-analysis-role` |

Self-contained HTML report. Rendered from `summary.json` + `follow-up.json`.
Designed for email delivery to the visitor and SDR review. No external
dependencies -- all styles inline.

---

### `v1-tenant/tenant.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Session orchestrator Lambda (`orchestrator.js` `createSession()` via `tenant-pool.js`) |
| **When** | During session creation, after tenant is claimed from the pool |
| **IAM writer** | `boothapp-app-role` |

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Matches parent session |
| `tenant_url` | string | Full Vision One portal URL for this tenant |
| `tenant_id` | string | Internal tenant identifier |
| `login_email` | string | Generated login for visitor self-service |
| `created_at` | string | ISO-8601 UTC -- when tenant was provisioned |
| `expires_at` | string | ISO-8601 UTC -- 30 days after creation |
| `status` | string | `"active"`, `"queued"` (if pool was empty) |
| `message` | string | Present when `status: "queued"` -- explanation |

---

## Related Files (bucket root, not per-session)

### `active-session.json`

| Attribute | Value |
|-----------|-------|
| **Created by** | Session orchestrator Lambda |
| **When** | On session start (created) and session end (deleted) |
| **S3 path** | `active-session.json` (bucket root) |

Polled by the Chrome extension every 2 seconds to detect session start/stop.

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Currently active session |
| `active` | boolean | Always `true` while file exists |
| `started_at` | string | ISO-8601 UTC |
| `visitor_name` | string | For display in extension popup |
| `stop_audio` | boolean | Set to `true` briefly before deletion to signal audio stop |

Deleted when session ends -- absence means no active session.

---

## Conventions

- All timestamps: UTC ISO-8601 (`2026-08-05T14:32:00Z`)
- All file paths in JSON: relative to the session folder
- Screenshots: JPEG, quality 60, max 1920x1080
- Audio: WAV, 44100 Hz, stereo
- Session ID: alphanumeric, 6-10 characters
- Any workstream can READ any file; only WRITE to files you own
- IAM policies enforce write boundaries (see `infra/s3-session-storage.yaml`)
