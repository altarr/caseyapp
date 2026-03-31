# BoothApp -- AI-Powered Trade Show Demo Capture

```
 ____              _   _       _
| __ )  ___   ___ | |_| |__   / \   _ __  _ __
|  _ \ / _ \ / _ \| __| '_ \ / _ \ | '_ \| '_ \
| |_) | (_) | (_) | |_| | | / ___ \| |_) | |_) |
|____/ \___/ \___/ \__|_| |_/_/   \_\ .__/| .__/
                                     |_|   |_|
```

> Record everything. Analyze instantly. Follow up personally.

A visitor walks up to your trade show booth. The SE gives a live product demo.
Minutes later, the visitor gets a personalized summary of exactly what they saw,
what interested them, and what to explore next -- powered by Claude AI.

---

## Architecture

```
  CAPTURE                     STORAGE             PROCESSING
  =======                     =======             ==========

  +------------------+
  | Chrome Extension |--+                     +-----------------+
  | clicks + screens |  |  +--------------+   | Watcher         |
  +------------------+  +->|              |-->| polls S3 for    |
                        |  |  S3 Session  |   | completed       |
  +------------------+  +->|    Store     |   | sessions        |
  | Audio Recorder   |  |  |              |   +--------+--------+
  | mic + transcript |--+  +--------------+            |
  +------------------+  |                              v
                        |                     +-----------------+
  +------------------+  |                     | Analysis        |
  | Badge Scanner    |--+                     | correlate       |
  | OCR + session ID |                        | clicks + audio  |
  +------------------+                        +--------+--------+
                                                       |
                                                       v
                                              +-----------------+
                                              | Claude AI       |
                                              | 1. interests    |
                                              | 2. engagement   |
                                              | 3. follow-up    |
                                              +--------+--------+
                                                       |
                                                       v
                                              +-----------------+
                                              | HTML Report     |
                                              | summary + recs  |
                                              | + action items  |
                                              +-----------------+
```

**Pipeline:** Chrome ext + audio + badge --> S3 --> watcher --> analysis --> Claude --> report

---

## Quick Start

**Prerequisites:** Node.js 18+ | AWS CLI | Chrome | ffmpeg | Python 3.10+

```bash
git clone https://github.com/altarr/boothapp.git && cd boothapp
npm install

# Chrome extension: chrome://extensions -> Developer Mode -> Load Unpacked -> extension/

# Analysis dependencies
cd analysis && npm install && pip install -r requirements.txt && cd ..

# Configure
cp .env.example .env   # edit with your AWS + API keys

# Launch (three terminals)
node infra/session-orchestrator/orchestrator.js   # Session API :3000
node analysis/watcher.js                          # S3 session poller
node audio/recorder.js                            # Mic capture

# Or run the full pipeline with synthetic data -- no hardware needed
bash scripts/run-demo-simulation.sh
```

---

## Session Lifecycle

```
  [1] Badge Scan    [2] Live Demo       [3] Upload       [4] AI Analysis
  ==============    ===========         =========        ===============

  OCR badge     --> Audio recording --> All data     --> Correlate clicks
  Extract name      Click tracking      to S3            + transcript
  Create session    Screenshots                     --> Claude two-pass
                                                    --> Render HTML report
```

**Status:** `active` --> `ended` --> `analyzing` --> `complete`

---

## Project Structure

```
boothapp/
  extension/     Chrome extension -- click tracking + screenshots (Manifest V3)
  audio/         Audio capture -- USB mic recording + transcription
  analysis/      AI pipeline -- correlator, Claude analyzer, report renderer
  infra/         Session orchestrator + S3 CloudFormation
  presenter/     Presenter dashboard -- session timeline + review UI
  demo/          Demo landing page + session review interface
  scripts/       Simulation, health check, integration tests
  docs/          Architecture docs + demo walkthrough
```

## S3 Session Layout

```
sessions/<session-id>/
  metadata.json           visitor info, status, timestamps
  audio/recording.wav     mic capture
  transcript/*.json       timestamped speaker segments
  clicks/clicks.json      click events with DOM paths
  screenshots/*.jpg       periodic + click-triggered captures
  output/summary.html     final HTML report
  output/summary.json     structured analysis data
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `run-demo-simulation.sh` | Full pipeline test with synthetic data |
| `health-check.sh` | Verify all services are running |
| `test-integration.sh` | Integration test suite |
| `validate-session.sh` | Validate session data completeness |

---

## Team

### Smells Like Machine Learning -- Hackathon 2026

| Name | Role |
|------|------|
| **Casey Mondoux** | App, web UI, presentation |
| **Joel Ginsberg** | Chrome extension, audio, AWS infra, AI analysis |
| **Tom Gamull** | App development |
| **Kush Mangat** | Presentation, demo flow |
| **Chris LaFleur** | V1 tenant provisioning, presentation |

---

*Every demo remembered. Every visitor followed up.*
