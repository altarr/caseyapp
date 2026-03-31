# Demo PC Setup Guide

Step-by-step instructions for setting up a Windows demo PC for CaseyApp. Each demo PC at the booth runs this setup.

---

## Prerequisites

- Windows 10/11 PC with admin access
- Internet connection
- USB microphone (for audio recording)
- Google Chrome browser
- Access to https://caseyapp.trendcyberrange.com (management server)

---

## Step 1: Install Required Software

Open PowerShell as Administrator and run:

```powershell
# Install Node.js LTS
winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements

# Install ffmpeg (for audio recording + MP3 conversion)
winget install --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements

# Install Git (for cloning the repo)
winget install --id Git.Git --accept-package-agreements --accept-source-agreements
```

**Close and reopen PowerShell** after installation so the new PATH entries take effect.

Verify installations:

```powershell
node --version    # Should show v22.x or higher
ffmpeg -version   # Should show ffmpeg version
git --version     # Should show git version
```

---

## Step 2: Clone the Repository

```powershell
cd C:\
git clone <repo-url> caseyapp
cd C:\caseyapp
```

If git clone is not available (private repo), download the code zip from S3:

```powershell
aws s3 cp s3://boothapp-sessions-752266476357/demo-setup/caseyapp-demo.zip C:\caseyapp.zip
Expand-Archive -Path C:\caseyapp.zip -DestinationPath C:\caseyapp -Force
cd C:\caseyapp
```

---

## Step 3: Install Node.js Dependencies

```powershell
# Root dependencies (AWS SDK, Express, etc.)
cd C:\caseyapp
npm install --production

# Packager dependencies (archiver, S3 upload)
cd C:\caseyapp\packager
npm install --production

# Return to root
cd C:\caseyapp
```

---

## Step 4: Configure AWS Credentials

The demo PC needs AWS credentials to access the S3 bucket. Run:

```powershell
aws configure
```

Enter when prompted:
- **AWS Access Key ID**: (get from team lead)
- **AWS Secret Access Key**: (get from team lead)
- **Default region**: `us-east-1`
- **Default output format**: `json`

Verify access:

```powershell
aws s3 ls s3://boothapp-sessions-752266476357/ --region us-east-1
```

You should see session folders listed (or an empty bucket if no sessions exist yet).

---

## Step 5: Test the USB Microphone

Plug in the USB microphone, then test detection:

```powershell
cd C:\caseyapp
node -e "const {execSync} = require('child_process'); console.log(execSync('ffmpeg -list_devices true -f dshow -i dummy 2>&1').toString())" 2>$null | Select-String "audio"
```

You should see your USB mic listed (e.g., "Yeti Stereo Microphone", "Blue Snowball", etc.).

If your mic doesn't auto-detect, note the exact device name and set it as an environment variable:

```powershell
$env:AUDIO_DEVICE = "Your Microphone Name"
```

---

## Step 6: Load the Chrome Extension

1. Open **Google Chrome**
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Browse to `C:\caseyapp\extension` and select the folder
6. The CaseyApp extension icon should appear in the toolbar

---

## Step 7: Configure the Chrome Extension

1. Click the **CaseyApp extension icon** in the Chrome toolbar to open the popup
2. Expand the **Management Server** section (click the gear icon if needed)
3. Enter the following settings:

| Setting | Value |
|---------|-------|
| **Management URL** | `https://caseyapp.trendcyberrange.com` |
| **Auth Token** | (get from management server — log in, then copy from browser dev tools or ask admin) |
| **Event** | Select your event from the dropdown (e.g., "Black Hat 2026") |
| **Demo PC Name** | A unique name for this PC (e.g., `booth-pc-1`, `booth-pc-2`) |

4. Click **Connect** — you should see a green status indicator
5. The extension will automatically register this demo PC with the management server

### Screenshot Settings (optional)

| Setting | Default | Description |
|---------|---------|-------------|
| Screenshot Interval | 1000ms | How often to capture (1000ms = 1 per second) |
| Screenshot Quality | Medium | Low/Medium/High (affects file size) |

---

## Step 8: Start the Packager Service

The packager runs locally on the demo PC. It receives screenshots from the extension, records audio, and packages everything for upload.

Open a new terminal and run:

```powershell
cd C:\caseyapp\packager
$env:S3_BUCKET = "boothapp-sessions-752266476357"
$env:AWS_REGION = "us-east-1"
node server.js
```

You should see:

```
============================================================
  CaseyApp Packager
  Listening on http://127.0.0.1:9222
  S3 Bucket: boothapp-sessions-752266476357
============================================================

  Waiting for session ...
```

**Leave this terminal open.** The packager must be running during demos.

### Verify the packager is running

In Chrome, check the extension popup — the **PC** status indicator should show green, confirming the extension can reach the packager at `localhost:9222`.

Or test manually:

```powershell
curl http://localhost:9222/status
```

Should return: `{"session_id":null,"active":false,"screenshot_count":0,...}`

---

## Step 9: Verify the Extension QR Code

1. Click the CaseyApp extension icon
2. You should see a **QR code** displayed
3. This QR code contains:
   - Management server URL
   - Event ID
   - Demo PC ID
   - Badge profile fields (from the event's trained badge profile)

The SE will scan this QR code with the Android app to pair the phone to this demo PC.

---

## Step 10: Test a Demo Session

### Quick test (no phone needed):

1. Open a browser tab to any website
2. Go to `https://caseyapp.trendcyberrange.com` and log in
3. Create a session: navigate to Sessions > click a test import, OR use the API:

```powershell
curl -X POST https://caseyapp.trendcyberrange.com/api/sessions/create `
  -H "Content-Type: application/json" `
  -d '{"visitor_name":"Test Visitor","demo_pc":"booth-pc-1","event_id":1}'
```

4. Watch the extension popup — it should show "Session Active" with a green indicator
5. Check the packager terminal — it should show "Session started" and begin recording audio
6. Wait 10 seconds (the extension takes screenshots every second)
7. End the session via the management server
8. The packager should show: WAV→MP3 conversion, zip creation, S3 upload

---

## Running on Demo Day

### Startup Checklist

1. [ ] Plug in USB microphone
2. [ ] Open Chrome with extension loaded
3. [ ] Verify extension shows green indicators (S3 or MGT, and PC)
4. [ ] Start packager: `node C:\caseyapp\packager\server.js`
5. [ ] Verify QR code is showing in extension popup
6. [ ] Tell the SE to scan the QR code with the Android app

### During Demos

The SE handles the phone. The demo PC just needs:
- Chrome open to the V1 console (or whatever product is being demoed)
- Packager running in a terminal
- USB mic plugged in

Everything else is automatic:
- Phone scans badge → session starts → extension captures screenshots
- Packager records audio
- SE taps End Session on phone → packager converts and uploads

### Between Demos

No action needed. The system resets automatically when a session ends. The next badge scan starts a new session.

### If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Extension shows red PC indicator | Restart the packager: `node C:\caseyapp\packager\server.js` |
| Extension shows red MGT indicator | Check internet connection. Verify management URL in extension settings. |
| No audio recording | Check USB mic is plugged in. Run the device detection test from Step 5. |
| Screenshots not capturing | Refresh the Chrome tab. Check extension is enabled at `chrome://extensions/`. |
| Packager crashes | Restart it. Check the error message. Common: port 9222 already in use. |
| Session not detected | Check that the management server created the session. Verify demo PC name matches. |

---

## Environment Variables Reference

Set these before starting the packager if you need to override defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | `boothapp-sessions-752266476357` | S3 bucket for session data |
| `AWS_REGION` | `us-east-1` | AWS region |
| `PORT` | `9222` | Packager HTTP port |
| `AUDIO_DEVICE` | (auto-detect) | Force a specific microphone |
| `POLL_INTERVAL_MS` | `2000` | How often packager polls S3 (ms) |

---

## Folder Structure on Demo PC

After setup, the demo PC should have:

```
C:\caseyapp\
├── extension\          ← Loaded into Chrome as unpacked extension
├── packager\           ← Local HTTP server (node server.js)
│   ├── sessions\       ← Temporary session data (screenshots, audio)
│   │   └── <session-id>\
│   │       ├── screenshots\
│   │       ├── recording.wav
│   │       └── recording.mp3
│   └── server.js
├── audio\              ← Audio recording libraries (used by packager)
├── node_modules\       ← Installed dependencies
└── ...
```

Session data under `packager/sessions/` is temporary — it's cleaned up after upload to S3. You can safely delete this folder between events.

---

## Multiple Demo PCs

Each demo PC at the booth gets its own setup. The key difference between PCs is the **Demo PC Name** in the extension settings (e.g., `booth-pc-1`, `booth-pc-2`, etc.). This name is how the management server routes sessions to the correct PC.

All PCs share:
- Same AWS credentials
- Same management server URL
- Same event

Each PC has:
- Unique Demo PC Name
- Its own QR code (generated from its name)
- Its own packager instance
