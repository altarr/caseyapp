# Demo Quick Start

## One-Click Setup

Run this on the demo PC before the event:

```bash
bash scripts/demo-day-setup.sh
```

This will:
1. Run preflight checks (AWS creds, Node.js, S3 bucket)
2. Upload mock V1 tenant pool to S3 (5 tenants)
3. Install npm dependencies if needed
4. Start the presenter dashboard (port 3000) and analysis watcher
5. Health-check all services
6. Print a status dashboard with URLs

## Running a Demo

### Option A: Web Form (recommended for demo day)

1. Open **http://localhost:3000/create-session.html**
2. Enter visitor name, company, SE name, and demo PC ID
3. Click **Start Session** — session ID is displayed with a copy button
4. Walk through the V1 demo in Chrome (extension captures clicks + screenshots)
5. Click **End Session** when done — analysis triggers automatically
6. View results at **http://localhost:3000/session-viewer.html?session=SESSION_ID**

### Option B: Android App

1. Open the BoothApp Android app
2. Point camera at visitor badge — OCR extracts name
3. Tap **Start Session** — session created via Lambda
4. Demo runs on the connected PC
5. Tap **End Session** — triggers upload and analysis

### Option C: CLI Script

```bash
bash scripts/run-demo.sh
```

Creates a session with sample data (Sarah Mitchell, Acme Corp) and runs the full pipeline.

## Pre-Demo Checklist

- [ ] `bash scripts/demo-day-setup.sh` ran successfully
- [ ] Chrome extension loaded (check extension popup for green status)
- [ ] USB microphone plugged in and detected
- [ ] Test session created and ended via web form
- [ ] Analysis output appeared in session viewer

## After the Demo

Clean up all demo resources from S3:

```bash
bash scripts/demo-cleanup.sh
```

This removes:
- Mock tenant pool (`tenant-pool/tenants.json` and locks)
- Demo sessions (`sessions/DEMO*`, `sessions/SIM*`)
- Command files (`commands/`)
- Active session marker (`active-session.json`)

Use `--force` to skip the confirmation prompt.

## Resource Tracking

All demo S3 objects are tagged with `boothapp-cleanup=demo-2026-04-01` for identification. The full list of managed prefixes is in `scripts/demo-resource-manifest.json`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Presenter not starting | Check `logs/presenter.log`. Run `npm install` in repo root. |
| "visitor_name required" error | Fill in the Visitor Name field (required). |
| Extension not detecting session | Refresh extension popup. Check S3 for `active-session.json`. |
| Analysis not running | Check `logs/watcher.log`. Watcher polls every 30s. |
| No tenant assigned | Run `bash scripts/setup-demo-tenants.sh` to reload pool. |
| S3 access denied | Run `aws sts get-caller-identity --profile hackathon` to verify creds. |
| Everything broken | Use pre-generated session: `bash scripts/generate-sample-session.sh` |

## Stop Services

```bash
# If running via demo-day-setup.sh, press Ctrl+C

# Or kill by PID (shown in setup output):
kill <presenter-pid> <watcher-pid>
```
