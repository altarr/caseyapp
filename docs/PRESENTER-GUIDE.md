# BoothApp Demo Presenter Guide

> Concise, step-by-step instructions for SEs running live booth demos.
> Print the Quick-Reference Cards at the end for on-the-floor use.

---

## Table of Contents

1. [Before the Show: Demo PC Setup](#1-before-the-show-demo-pc-setup)
2. [Starting a Session (Android App)](#2-starting-a-session-android-app)
3. [Giving the Vision One Demo](#3-giving-the-vision-one-demo)
4. [Ending the Session & Viewing the Report](#4-ending-the-session--viewing-the-report)
5. [Troubleshooting](#5-troubleshooting)
6. [Quick-Reference Cards](#6-quick-reference-cards)

---

## 1. Before the Show: Demo PC Setup

### Prerequisites

| Item | Details |
|------|---------|
| Chrome browser | Latest stable version |
| USB/wireless microphone | Plugged in and set as default input |
| Node.js 18+ | For the audio recorder service |
| ffmpeg | For audio capture (`winget install ffmpeg` on Windows) |
| AWS CLI | Profile `hackathon` configured |
| Android phone | With BoothApp installed, camera working |

### Step 1: Clone & Install

```bash
git clone <repo-url> && cd boothapp
npm install
cd audio && npm install && cd ..
```

### Step 2: Run the Setup Wizard

```bash
bash scripts/setup-demo-pc.sh
```

This interactive script:
- Verifies Chrome is installed
- Walks you through loading the V1-Helper extension
- Creates your `.env` file (S3 bucket, AWS profile, region)
- Tests S3 connectivity
- Detects your audio device

Fix any `[FAIL]` items before proceeding.

### Step 3: Install the Chrome Extension

1. Open Chrome -> navigate to `chrome://extensions`
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked** -> select the `extension/` folder
4. **Pin** the V1-Helper icon in the toolbar for quick access

<!-- screenshot: chrome-extensions-loaded.png -->
> [Screenshot placeholder: Chrome extensions page with V1-Helper loaded and pinned]

### Step 4: Configure the Extension

1. Click the V1-Helper icon in the toolbar
2. Click the **gear icon** (top-right of popup)
3. Enter S3 configuration:
   - **S3 Bucket:** `boothapp-sessions-752266476357`
   - **AWS Region:** `us-east-1`
   - **Presign Endpoint URL:** (from your Lambda deployment)
   - **Access Key ID / Secret Access Key:** (hackathon profile creds)
4. Click **Save**
5. The S3 indicator dot turns **green** when connected

<!-- screenshot: extension-popup-configured.png -->
> [Screenshot placeholder: V1-Helper popup showing green S3 dot and IDLE status]

### Step 5: Start the Audio Recorder

In a terminal that stays open during all demos:

```bash
cd audio
set S3_BUCKET=boothapp-sessions-752266476357
node recorder.js
```

The recorder will wait for a session to become active, then start capturing automatically.

### Step 6: Run Preflight Check

```bash
bash scripts/preflight.sh
```

All items must show `PASS`. If anything fails, fix it before demo day.

---

## 2. Starting a Session (Android App)

### Before the Visitor Arrives

- Open V1 to the **Dashboard** in Chrome
- Confirm the V1-Helper popup shows **IDLE** with a green S3 dot
- Confirm the audio recorder terminal shows "Waiting for session..."

### When the Visitor Walks Up

1. **Open the BoothApp Android app**
2. **Tap "New Session"**
3. **Photograph the visitor's badge** -- hold steady, ensure the name is legible
4. The app runs OCR and extracts the visitor's name
5. **Confirm the name** on screen (tap to edit if OCR missed)
6. **Tap "Start Session"**

<!-- screenshot: android-badge-scan.png -->
> [Screenshot placeholder: Android app showing badge photo with extracted name]

### What Happens Automatically

Once the session starts:

```
Android app              AWS S3                  Demo PC
    |                      |                       |
    |-- metadata.json ---->|                       |
    |-- badge.jpg -------->|                       |
    |                      |<--- polls every 1s ---|
    |                      |---- session found! -->|
    |                      |                       |-- audio starts
    |                      |                       |-- click tracking ON
    |                      |                       |-- screenshots ON
```

- The V1-Helper popup changes to **RECORDING** (pulsing red ring, timer counting up)
- The audio recorder terminal shows "Recording started for session: ..."
- A visitor name appears below the status ring

**You have about 3 seconds** between tapping "Start Session" and capture beginning. Wait for the red ring before starting your demo talk.

---

## 3. Giving the Vision One Demo

### Demo Flow (Recommended ~10 minutes)

Follow this order for maximum engagement. Adapt based on what the visitor asks about.

#### Opening (1 min)

> "Let me show you Vision One -- our unified security platform.
> This session is being captured so we can send you a personalized summary
> of everything we cover today."

#### 1. Dashboard Overview (2 min)

- Start on the **V1 Dashboard**
- Highlight the risk score and active alerts
- Point out the unified view across endpoints, email, network

<!-- screenshot: v1-dashboard.png -->
> [Screenshot placeholder: V1 Dashboard with risk score and alerts]

#### 2. XDR Detection & Response (3 min)

- Navigate to **XDR** in the left sidebar
- Show a detection with correlated events across multiple vectors
- Demonstrate the investigation timeline
- Show the automated response actions

<!-- screenshot: v1-xdr-detection.png -->
> [Screenshot placeholder: XDR detection with correlated timeline]

#### 3. Endpoint Security (2 min)

- Navigate to **Endpoint Security Operations**
- Show the endpoint inventory
- Demonstrate the policy management interface
- Highlight real-time protection status

#### 4. Attack Surface Management (2 min)

- Navigate to **Attack Surface Discovery**
- Show internet-facing assets
- Highlight risk prioritization
- Demonstrate the remediation workflow

#### Tailoring to Visitor Interest

| If they ask about... | Show them... |
|---------------------|-------------|
| Cloud security | Cloud Security > Workload Protection |
| Email threats | Email Security Operations |
| Zero trust | Zero Trust Secure Access |
| Network security | Network Security Operations |
| Compliance | Compliance section |
| API/automation | Administration > Automation Center |

### Tips for a Great Demo

- **Click deliberately** -- every click is captured with a screenshot
- **Narrate as you go** -- the audio transcript drives the AI summary
- **Pause on key screens** -- give the periodic screenshot 2-3 seconds to capture
- **Say the visitor's name** -- the AI picks up personalization cues
- **Ask questions** -- "Is endpoint protection your biggest concern?" helps the AI identify interests

---

## 4. Ending the Session & Viewing the Report

### End the Session

1. On the **Android app**, tap **"End Session"**
2. The app writes the end signal to S3

### What Happens Automatically

```
Android app              AWS S3                  Demo PC
    |                      |                       |
    |-- end signal ------->|                       |
    |                      |<--- detects end ------|
    |                      |                       |-- audio stops
    |                      |                       |-- data uploads
    |                      |                       |
    |                      |---- Watcher --------->|
    |                      |     detects complete  |
    |                      |                       |
    |                      |<--- Claude analysis --|
    |                      |---- summary.html ---->|
```

1. The V1-Helper popup changes to **UPLOADING** (blue spinner)
2. Clicks, screenshots, and audio upload to S3
3. The popup changes to **COMPLETE** (green checkmark)
4. The **session watcher** detects the completed session
5. The **analysis pipeline** runs:
   - Correlates clicks + screenshots + audio transcript by timestamp
   - Claude AI analyzes the unified timeline
   - Generates a personalized HTML report
6. Report appears in S3: `sessions/<session-id>/output/summary.html`

<!-- screenshot: extension-popup-complete.png -->
> [Screenshot placeholder: V1-Helper popup showing green checkmark and session stats]

### Viewing the Report

**Option A: Presenter Dashboard**

Open `presenter/index.html` in a browser to see all sessions and their reports.

**Option B: Direct S3**

```bash
aws s3 cp s3://boothapp-sessions-752266476357/sessions/<SESSION_ID>/output/summary.html ./report.html --profile hackathon
open report.html   # macOS
start report.html  # Windows
```

### What the Report Contains

- Visitor name and session metadata
- Executive summary of the demo
- Key interests identified from conversation + click patterns
- Screenshots of the most-viewed pages
- Recommended follow-up actions for the SDR team
- Link to the visitor's dedicated V1 tenant (preserved 30 days)

<!-- screenshot: sample-report.png -->
> [Screenshot placeholder: Generated HTML report showing visitor summary and recommendations]

### Show the Visitor (Optional)

If the report generates quickly (~2 min), you can show it to the visitor before they leave:

> "Here's a preview of the personalized summary we'll email you.
> It includes a link to your own Vision One environment where you
> can continue exploring for the next 30 days."

---

## 5. Troubleshooting

### Extension Issues

| Problem | Fix |
|---------|-----|
| S3 dot stays **red** | Click gear icon, verify credentials. Check that the presign endpoint URL is correct. |
| Popup stays on **IDLE** after session starts | Session may not be in S3 yet. Wait 5 seconds. Check the Android app shows "Session Active". |
| No click counts incrementing | Refresh the page once. Content script may not have injected. |
| "Service worker inactive" in chrome://extensions | Click the reload button on the extension card. |
| Extension disappeared after Chrome update | Re-load unpacked from `extension/` folder. |

### Audio Issues

| Problem | Fix |
|---------|-----|
| "No audio device found" | Run `npm run list-devices` in `audio/` to see available devices. Set `AUDIO_DEVICE=<name>` and restart. |
| Wrong microphone selected | Set `AUDIO_DEVICE` env var to the correct device name. |
| Audio recorder not starting | Check terminal for errors. Verify `S3_BUCKET` and `SESSION_ID` env vars. |
| Visitor objects to recording | Create `sessions/<ID>/commands/stop-audio` in S3 (empty file). Audio stops within 2 seconds. |

### Session Issues

| Problem | Fix |
|---------|-----|
| Android app can't create session | Check phone has internet. Verify the Lambda endpoint URL in app settings. |
| Demo PC doesn't detect session | Check S3 connectivity (`aws s3 ls s3://<bucket> --profile hackathon`). Verify the extension S3 config matches. |
| Session stuck on "UPLOADING" | Large sessions take 30-60 seconds. If stuck > 2 min, check Chrome DevTools console for errors. |
| Report not generating | Check if the watcher is running (`node analysis/watcher.js`). Check CloudWatch logs for Lambda errors. |

### Nuclear Options

If everything is broken and a visitor is waiting:

1. **Skip the capture** -- just give the demo manually, collect a business card
2. **Restart everything:**
   ```bash
   # Kill all node processes
   pkill -f "node.*recorder"
   pkill -f "node.*watcher"

   # Restart
   cd audio && node recorder.js &
   cd analysis && node watcher.js &
   ```
3. **Run the demo checklist** to find what broke:
   ```bash
   bash scripts/demo-checklist.sh
   ```

---

## 6. Quick-Reference Cards

Print these and keep them at the demo station.

---

### CARD A: Session Lifecycle

```
+---------------------------------------------------+
|          BOOTHAPP SESSION QUICK REFERENCE          |
+---------------------------------------------------+
|                                                   |
|  BEFORE DEMO                                      |
|    [ ] Chrome open with V1 Dashboard              |
|    [ ] V1-Helper shows IDLE + green S3 dot        |
|    [ ] Audio recorder terminal running             |
|                                                   |
|  START                                            |
|    1. Android app -> "New Session"                |
|    2. Photo badge -> confirm name                 |
|    3. Tap "Start Session"                         |
|    4. Wait for red pulsing ring in extension      |
|                                                   |
|  DURING DEMO                                      |
|    - Click deliberately (each click = screenshot) |
|    - Narrate everything (audio -> transcript)     |
|    - ~10 minutes recommended                      |
|                                                   |
|  END                                              |
|    1. Android app -> "End Session"                |
|    2. Wait for green checkmark in extension       |
|    3. Report generates in ~2 minutes              |
|                                                   |
+---------------------------------------------------+
```

---

### CARD B: V1 Demo Flow

```
+---------------------------------------------------+
|            V1 DEMO WALK-THROUGH                    |
+---------------------------------------------------+
|                                                   |
|  1. DASHBOARD (2 min)                             |
|     Risk score, active alerts, unified view       |
|                                                   |
|  2. XDR (3 min)                                   |
|     Detection, correlated timeline, response      |
|                                                   |
|  3. ENDPOINT SECURITY (2 min)                     |
|     Inventory, policies, protection status        |
|                                                   |
|  4. ATTACK SURFACE (2 min)                        |
|     Internet-facing assets, risk prioritization   |
|                                                   |
|  ADAPT TO VISITOR:                                |
|     Cloud? -> Cloud Security                      |
|     Email? -> Email Security Ops                  |
|     Zero Trust? -> ZTSA                           |
|     Network? -> Network Security Ops              |
|                                                   |
|  TIPS:                                            |
|     - Say visitor's name during demo              |
|     - Ask "What's your biggest concern?"          |
|     - Pause 2-3s on key screens                   |
|                                                   |
+---------------------------------------------------+
```

---

### CARD C: Troubleshooting Cheat Sheet

```
+---------------------------------------------------+
|          TROUBLESHOOTING CHEAT SHEET               |
+---------------------------------------------------+
|                                                   |
|  RED S3 DOT                                       |
|    -> Check credentials in extension gear menu    |
|                                                   |
|  NO SESSION DETECTED                              |
|    -> Wait 5s. Check Android shows "Active"       |
|    -> Restart: close/reopen extension popup        |
|                                                   |
|  NO AUDIO                                         |
|    -> cd audio && npm run list-devices            |
|    -> Set AUDIO_DEVICE=<correct device>           |
|    -> Restart: node recorder.js                   |
|                                                   |
|  VISITOR OBJECTS TO RECORDING                     |
|    -> "No problem!" (audio stops, demo continues) |
|    -> Upload empty file to S3:                    |
|       sessions/<ID>/commands/stop-audio           |
|                                                   |
|  EVERYTHING BROKEN                                |
|    -> bash scripts/demo-checklist.sh              |
|    -> Give demo manually, collect business card   |
|                                                   |
|  SCRIPTS:                                         |
|    Setup:     bash scripts/setup-demo-pc.sh       |
|    Preflight: bash scripts/preflight.sh           |
|    Checklist: bash scripts/demo-checklist.sh      |
|                                                   |
+---------------------------------------------------+
```

---

### CARD D: Extension Status Ring

```
+---------------------------------------------------+
|          V1-HELPER STATUS REFERENCE                |
+---------------------------------------------------+
|                                                   |
|  GRAY ring    = IDLE (no active session)          |
|  RED pulsing  = RECORDING (capture in progress)   |
|  BLUE spinner = UPLOADING (sending data to S3)    |
|  GREEN check  = COMPLETE (ready for next session) |
|  RED solid    = ERROR (check console / restart)   |
|                                                   |
|  STATS:                                           |
|    Clicks      = total tracked clicks             |
|    Screenshots = captures taken                   |
|                                                   |
|  S3 DOT (top-right):                              |
|    Green = connected to S3                        |
|    Red   = disconnected (check gear settings)     |
|                                                   |
+---------------------------------------------------+
```
