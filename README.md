# BoothApp - AI-Powered Trade Show Demo Capture

```
 ____              _   _       _
| __ )  ___   ___ | |_| |__   / \   _ __  _ __
|  _ \ / _ \ / _ \| __| '_ \ / _ \ | '_ \| '_ \
| |_) | (_) | (_) | |_| | | / ___ \| |_) | |_) |
|____/ \___/ \___/ \__|_| |_/_/   \_\ .__/| .__/
                                     |_|   |_|
```

> **Record everything. Analyze instantly. Follow up personally.**

A visitor walks up to your trade show booth. The SE gives a live product demo.
Minutes later, the visitor gets a personalized AI summary of what they saw,
what caught their attention, and recommended next steps.

---

## Architecture

```
  CAPTURE                    STORE                  PROCESS
  -------                    -----                  -------

  +----------------+
  | Chrome Ext     |--+
  | clicks+screens |  |    +--------------+    +----------------+
  +----------------+  +--> |              | -> | Watcher        |
                      |    |   AWS S3     |    | polls for new  |
  +----------------+  +--> |   sessions/  |    | sessions       |
  | Audio Recorder |  |    |              |    +-------+--------+
  | mic+transcript |--+    +--------------+            |
  +----------------+  |                                v
                      |                        +-------+--------+
  +----------------+  |                        | Analysis       |
  | Badge Scanner  |--+                        | correlate all  |
  | OCR+session ID |                           | data by time   |
  +----------------+                           +-------+--------+
                                                       |
                                                       v
                                               +-------+--------+
                                               | Claude AI      |
                                               | interests      |
                                               | engagement     |
                                               | follow-up recs |
                                               +-------+--------+
                                                       |
                                                       v
                                               +----------------+
                                               | HTML Report    |
                                               | personalized   |
                                               | summary + recs |
                                               +----------------+
```

**Pipeline:** `Chrome ext + audio + badge --> S3 --> watcher --> analysis --> Claude --> report`

---

## How It Works

| Step | What Happens |
|------|-------------|
| **1. Badge Scan** | Photo of visitor badge -> OCR -> name extracted -> session ID created |
| **2. Live Demo** | SE demos the product; audio records, extension tracks clicks + takes screenshots |
| **3. Upload** | Session ends -> all captured data uploads to S3 |
| **4. AI Analysis** | Watcher detects completed session -> Claude correlates clicks + audio + screens |
| **5. Report** | Personalized HTML summary with interests, engagement signals, and follow-up recs |

Status flow: `active` -> `ended` -> `analyzing` -> `complete`

---

## Quick Start

**Prerequisites:** Node.js 18+ | AWS CLI | Chrome | ffmpeg

```bash
# Clone and install
git clone https://github.com/altarr/boothapp.git && cd boothapp
npm install

# Chrome extension
#   chrome://extensions -> Developer Mode -> Load Unpacked -> select extension/

# Analysis deps
cd analysis && npm install && pip install -r requirements.txt && cd ..

# Configure
cp .env.example .env     # Add AWS credentials + Claude API key

# Run full pipeline with synthetic data (no hardware needed)
bash scripts/run-demo-simulation.sh
```

### Individual Services

```bash
node infra/session-orchestrator/orchestrator.js   # Session API    :3000
node analysis/watcher.js                          # S3 poller
node audio/recorder.js                            # Mic capture
```

---

## Project Structure

```
boothapp/
  extension/     Chrome extension (Manifest V3) -- click tracking + screenshots
  audio/         Audio capture + transcription via Whisper
  analysis/      AI pipeline -- correlator, Claude analyzer, report renderer
  infra/         Session orchestrator + S3 CloudFormation
  presenter/     Presenter dashboard -- session timeline + review UI
  demo/          Demo landing page + session review interface
  scripts/       Simulation, health checks, integration tests
  docs/          Architecture docs + demo walkthrough
```

### S3 Session Layout

```
sessions/<session-id>/
  metadata.json           visitor info, status, timestamps
  audio/recording.wav     mic capture
  transcript/*.json       timestamped speaker segments
  clicks/clicks.json      click events with DOM paths
  screenshots/*.jpg       periodic + click-triggered captures
  output/summary.html     final personalized report
  output/summary.json     structured analysis data
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Capture | Chrome Extension (Manifest V3), ffmpeg, Whisper |
| Storage | AWS S3, CloudFormation |
| Analysis | Node.js, Python, Claude API (two-pass) |
| Output | HTML reports, structured JSON |
| Orchestration | Express session API, S3 event polling |

---

## Team

### Smells Like Machine Learning -- Hackathon 2026

| Name | Focus |
|------|-------|
| **Casey Mondoux** | App, web UI, presentation |
| **Joel Ginsberg** | Chrome extension, audio, AWS infra, AI analysis |
| **Tom Gamull** | App development |
| **Kush Mangat** | Presentation, demo flow |
| **Chris LaFleur** | V1 tenant provisioning, presentation |

---

*Built for Black Hat, RSA, and re:Invent. Every demo remembered. Every visitor followed up.*
