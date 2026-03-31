# Demo Walkthrough -- Hackathon Presentation Script

> Step-by-step script for the "Smells Like Machine Learning" hackathon demo.
> Target: ~15 minutes total. Practice this flow at least twice before going live.

---

## Table of Contents

1. [Pre-Demo Checklist](#1-pre-demo-checklist)
2. [Demo Flow](#2-demo-flow)
   - [Step A: Take Badge Photo](#step-a-take-badge-photo)
   - [Step B: Start Session on Phone](#step-b-start-session-on-phone)
   - [Step C: Vision One Demo](#step-c-vision-one-demo)
   - [Step D: End Session on Phone](#step-d-end-session-on-phone)
3. [Show Real-Time Analysis](#3-show-real-time-analysis)
4. [Display the Generated Report](#4-display-the-generated-report)
5. [Show Follow-Up Email Template](#5-show-follow-up-email-template)
6. [Show Analytics Dashboard](#6-show-analytics-dashboard)
7. [Recovery Playbook](#7-recovery-playbook)

---

## 1. Pre-Demo Checklist

Run through this checklist 10 minutes before presenting. Every item must be green.

```
+-----------------------------------------------------------------+
|                   PRE-DEMO CHECKLIST                            |
+-----------------------------------------------------------------+
|                                                                 |
|  DEMO PC                                                        |
|  [ ] Chrome open with Vision One Dashboard                      |
|  [ ] V1-Helper extension loaded (chrome://extensions)           |
|      -> Popup shows IDLE + green S3 dot                         |
|  [ ] Audio recorder running in terminal:                        |
|      cd audio && node recorder.js                               |
|      -> Shows "Waiting for session..."                          |
|  [ ] Watcher running in separate terminal:                      |
|      cd analysis && node watcher.js                             |
|      -> Shows "Watching for completed sessions..."              |
|                                                                 |
|  AWS / S3                                                        |
|  [ ] S3 bucket accessible:                                       |
|      aws s3 ls s3://boothapp-sessions-752266476357               |
|          --profile hackathon                                     |
|  [ ] No stale sessions in bucket (clean slate)                   |
|                                                                 |
|  ANDROID APP                                                     |
|  [ ] BoothApp installed and open on phone                        |
|  [ ] Phone connected to venue WiFi (same network as demo PC)    |
|  [ ] Camera permission granted                                   |
|  [ ] Test badge photo works (try a business card)                |
|                                                                 |
|  PRESENTER DASHBOARD                                             |
|  [ ] Presenter server running:                                   |
|      cd presenter && node server.js                              |
|  [ ] Dashboard accessible at http://localhost:3000               |
|  [ ] Analytics page loads: http://localhost:3000/analytics.html  |
|                                                                 |
|  DISPLAY SETUP                                                   |
|  [ ] Demo PC screen visible to audience (projector/TV)           |
|  [ ] Phone screen castable or visible (optional)                 |
|  [ ] Second browser tab ready for presenter dashboard            |
|                                                                 |
+-----------------------------------------------------------------+
```

### Quick Verify Script

```bash
bash scripts/preflight.sh
```

All items must show `PASS`. Fix any failures before starting.

---

## 2. Demo Flow

### Opening (30 seconds)

**TALKING POINT:**

> "We're team 'Smells Like Machine Learning.' Our project captures everything
> that happens during a live booth demo -- every click, every word, every
> screenshot -- and uses Claude AI to generate a personalized follow-up
> package for the visitor. Let me show you how it works, live."

---

### Step A: Take Badge Photo

**What you do:** Hold up a sample badge. Open the Android app and photograph it.

**On screen:** The phone's camera viewfinder, then the OCR result.

**Duration:** ~30 seconds

**Actions:**
1. Hold the sample badge up so the audience can see it
2. On the Android app, tap **"New Session"**
3. Point the camera at the badge and snap the photo
4. The app runs OCR and displays the extracted name
5. Confirm the name on screen (edit if OCR missed)

**TALKING POINT:**

> "When a visitor walks up to our booth, the first thing we do is snap a
> photo of their badge. OCR extracts their name automatically -- no manual
> typing, no scanning a QR code. This creates a unique session for
> everything that follows."

**What to show the audience:**
- The badge photo on the phone screen
- The extracted visitor name
- The session ID that was generated

---

### Step B: Start Session on Phone

**What you do:** Tap "Start Session" on the Android app.

**On screen:** The V1-Helper extension transitions from IDLE to RECORDING.

**Duration:** ~15 seconds

**Actions:**
1. Tap **"Start Session"** on the Android app
2. Point to the Chrome extension popup -- watch it change:
   - Gray ring (IDLE) -> Red pulsing ring (RECORDING)
   - Visitor name appears below the status
   - Timer starts counting up
3. Point to the audio recorder terminal -- it shows "Recording started for session: ..."

**TALKING POINT:**

> "The moment I tap 'Start Session', three things happen simultaneously.
> The Chrome extension starts tracking every click and taking screenshots.
> The audio recorder captures our conversation. And all of it is tagged
> to this visitor's session. The demo PC detected the new session from
> S3 within seconds -- no manual wiring."

**What to show the audience:**
- Extension popup: red pulsing ring with timer
- Audio terminal: recording confirmation
- Emphasize: zero manual setup on the PC side

---

### Step C: Vision One Demo

**What you do:** Walk through Vision One as if giving a real booth demo.

**On screen:** Vision One console in Chrome, with clicks being tracked live.

**Duration:** ~5 minutes

**Actions and talking points for each V1 area:**

#### C1. XDR Search (2 minutes)

**Navigate to:** XDR > Search (left sidebar, icon #4)

**Actions:**
1. Click into the XDR search interface
2. Run a sample query (e.g., search for a known detection)
3. Click into a detection to show the correlated timeline
4. Expand an event to show cross-vector correlation

**TALKING POINT:**

> "Here I'm showing the visitor our XDR capabilities. Notice every click
> I make is being captured -- the extension records the DOM element, the
> page URL, and takes a timestamped screenshot. The AI will later use
> this to understand exactly what the visitor saw and what interested them."

**Tips:**
- Click deliberately -- each click generates a screenshot
- Pause 2-3 seconds on important screens
- Narrate what you're showing (audio transcript drives the summary)

#### C2. Endpoint Inventory (1.5 minutes)

**Navigate to:** Endpoint Security Operations > Endpoint Inventory

**Actions:**
1. Show the list of managed endpoints
2. Click into one endpoint to show details
3. Show the protection status and agent version
4. Demonstrate a filter (e.g., by OS type)

**TALKING POINT:**

> "Now I'm showing endpoint inventory. The visitor can see every managed
> device, their protection status, agent versions. If they ask about a
> specific OS, I can filter right here. The AI captures that they were
> interested in endpoint management -- that becomes a follow-up action."

#### C3. Risk Insights (1.5 minutes)

**Navigate to:** Cyber Risk Overview (left sidebar, icon #1)

**Actions:**
1. Show the overall risk score
2. Click into a risk category to see details
3. Show the risk trend over time
4. Highlight a specific remediation recommendation

**TALKING POINT:**

> "Risk Insights gives a quantified view of their security posture. The
> visitor's questions here -- 'How do you calculate the score?' or 'Can I
> drill into this category?' -- are captured in the audio and reflected
> in the AI-generated summary as areas of interest."

---

### Step D: End Session on Phone

**What you do:** Tap "End Session" on the Android app.

**On screen:** Extension transitions from RECORDING to UPLOADING to COMPLETE.

**Duration:** ~30 seconds

**Actions:**
1. On the Android app, tap **"End Session"**
2. Watch the Chrome extension popup:
   - Red pulsing (RECORDING) -> Blue spinner (UPLOADING)
   - Click count and screenshot count displayed
   - Blue spinner -> Green checkmark (COMPLETE)
3. Point to the audio recorder terminal: "Recording stopped, uploading..."

**TALKING POINT:**

> "I just ended the session. Watch the extension -- it's uploading all the
> click data and screenshots to S3. The audio recorder is uploading the
> WAV file. In about 30 seconds, everything from this demo will be in
> the cloud, ready for AI analysis."

**What to show the audience:**
- Extension status transition: RECORDING -> UPLOADING -> COMPLETE
- Final stats: number of clicks tracked, screenshots captured
- Audio terminal: upload confirmation

---

## 3. Show Real-Time Analysis

**What you do:** Switch to the watcher terminal and the live dashboard.

**On screen:** Terminal output showing the watcher detecting and processing the session.

**Duration:** ~2 minutes (while analysis runs)

**Actions:**
1. Switch to the terminal running `node watcher.js`
2. Show the log output:
   ```
   [14:47:12] New completed session detected: A726594
   [14:47:13] Downloading session data...
   [14:47:15] Running correlator: merging clicks + transcript + screenshots
   [14:47:18] Sending to Claude for analysis (2-pass)...
   [14:47:45] Pass 1 complete: structured extraction
   [14:47:58] Pass 2 complete: executive summary + recommendations
   [14:48:01] Generating HTML report...
   [14:48:03] Report written to output/summary.html
   [14:48:03] Session A726594 analysis complete (51s)
   ```
3. (Optional) Switch to the live dashboard at `http://localhost:3000/live.html`
   to show the session status updating in real time

**TALKING POINT:**

> "Here's where the magic happens. The watcher detected that our session
> is complete -- all the data arrived in S3. It's now running the analysis
> pipeline: first it correlates the clicks, screenshots, and audio transcript
> into a unified timeline. Then Claude AI does a two-pass analysis --
> first extracting structured data, then writing an executive summary
> with personalized follow-up recommendations. This takes about a minute."

**While waiting, explain:**
- The correlator merges all data sources by timestamp
- Claude sees the screenshots alongside the transcript
- Two-pass analysis: structured extraction first, then narrative summary
- Everything is automated -- no human in the loop for analysis

---

## 4. Display the Generated Report

**What you do:** Open the generated HTML report.

**On screen:** The visitor's personalized summary report.

**Duration:** ~2 minutes

**Actions:**
1. Open the report from the presenter dashboard:
   - Go to `http://localhost:3000/sessions.html`
   - Click the session that just completed
   - Click "View Report"
2. Or open directly:
   ```bash
   aws s3 cp s3://boothapp-sessions-752266476357/sessions/<ID>/output/summary.html ./report.html --profile hackathon
   start report.html
   ```

**Walk through the report sections:**

| Section | What to highlight |
|---------|------------------|
| **Header** | Visitor name, date, session duration, SE name |
| **Executive Summary** | AI-written paragraph summarizing the entire demo |
| **Products Demonstrated** | Auto-detected from click data and page URLs |
| **Key Interests** | Topics the visitor asked about, with confidence levels |
| **Key Moments** | Screenshots of the most important interactions, with AI commentary |
| **Follow-Up Actions** | Specific next steps for the SDR team |
| **Session Score** | 1-10 rating of visitor engagement |

**TALKING POINT:**

> "This is the output -- a personalized report generated entirely by AI.
> Look at the key interests: the system identified that the visitor spent
> the most time on endpoint inventory and asked questions about XDR
> detection rules. The follow-up actions are specific: 'Send endpoint
> policy best practices guide' and 'Schedule a deep-dive on custom
> detection rules.' An SDR can act on this immediately without having
> been in the room."

---

## 5. Show Follow-Up Email Template

**What you do:** Show the auto-generated email ready to send to the visitor.

**On screen:** The follow-up email HTML template.

**Duration:** ~1 minute

**Actions:**
1. From the session view, click "View Email Template" or open directly:
   ```bash
   aws s3 cp s3://boothapp-sessions-752266476357/sessions/<ID>/output/follow-up-email.html ./email.html --profile hackathon
   start email.html
   ```
2. Show the email content:
   - Personalized greeting with visitor name
   - Summary of what they saw
   - Links to resources matching their interests
   - Link to their dedicated V1 tenant (30-day access)
   - CTA to schedule a follow-up meeting

**TALKING POINT:**

> "This is the email that goes to the visitor. It's not a generic
> 'Thanks for visiting our booth' blast -- it's personalized to exactly
> what they saw and asked about. It includes a link to their own Vision
> One tenant where they can keep exploring for 30 days. The SDR reviews
> this, optionally edits it, and sends. From badge scan to personalized
> follow-up in under 5 minutes."

---

## 6. Show Analytics Dashboard

**What you do:** Open the analytics page showing all demo sessions.

**On screen:** Aggregated analytics across all sessions.

**Duration:** ~1 minute

**Actions:**
1. Navigate to `http://localhost:3000/analytics.html`
2. Walk through the dashboard sections:

| Section | What to highlight |
|---------|------------------|
| **Session count** | Total demos given, completion rate |
| **Top products** | Which V1 areas were shown most |
| **Interest trends** | What visitors asked about most across all sessions |
| **Engagement scores** | Distribution of session scores |
| **Timeline** | When demos happened (busy hours, peak times) |
| **SE leaderboard** | Which SEs gave the most demos |

3. (Optional) Click into a specific session to show drill-down

**TALKING POINT:**

> "Finally, the analytics dashboard aggregates everything across all demos.
> Management can see: how many demos were given, which products generated
> the most interest, which SEs were busiest. This turns a trade show
> from a pile of business cards into actionable data. After Black Hat,
> we know exactly which 50 visitors are most likely to buy, and what
> they care about."

---

## 7. Recovery Playbook

Things break during live demos. Here's how to recover without losing the audience.

### Extension Not Detecting Session

**Symptom:** Tapped "Start Session" on phone but extension stays IDLE.

**Recovery (15 seconds):**
1. Click the V1-Helper extension icon to open popup
2. Click the refresh/reconnect button
3. If still IDLE, close and reopen the popup

**Talking point while fixing:**
> "The extension polls S3 for new sessions -- let me give it a nudge."

### Audio Recorder Crashed

**Symptom:** Audio terminal shows an error or is unresponsive.

**Recovery (10 seconds):**
```bash
cd audio && node recorder.js
```

**Talking point while fixing:**
> "The audio recorder runs as a separate service -- easy to restart."

**If it won't restart:** Continue the demo without audio. The click data
and screenshots alone produce a useful (though less detailed) report.

### Watcher Not Processing

**Symptom:** Session completed but no analysis output after 2 minutes.

**Recovery (30 seconds):**
```bash
# Check if watcher is running
ps aux | grep watcher

# If not running, restart
cd analysis && node watcher.js

# Or trigger manual analysis
node analysis/pipeline-run.js --session <SESSION_ID>
```

**Talking point while fixing:**
> "The watcher polls S3 every 30 seconds. Let me trigger the pipeline
> manually -- same result, just faster for the demo."

### S3 Upload Stuck

**Symptom:** Extension shows UPLOADING for more than 60 seconds.

**Recovery:**
1. Check Chrome DevTools console (F12) for errors
2. Verify S3 connectivity: `aws s3 ls s3://boothapp-sessions-752266476357 --profile hackathon`
3. If network issue, wait for reconnection -- uploads resume automatically

**Talking point while fixing:**
> "We're on conference WiFi, so uploads can be slow. The system is
> resilient -- it'll retry automatically."

### Report Looks Wrong or Incomplete

**Symptom:** Report generated but missing sections or has bad data.

**Recovery:**
1. Re-run the analysis: `node analysis/pipeline-run.js --session <SESSION_ID> --force`
2. Refresh the report page

**Talking point while fixing:**
> "AI analysis is non-deterministic -- occasionally we re-run for a
> better result. Same data, fresh analysis."

### Nuclear Option: Everything Is Broken

If multiple things fail simultaneously:

1. **Don't panic.** You have a pre-recorded backup.
2. Switch to the pre-captured demo session:
   ```bash
   # Load the sample session data
   cd analysis/sample_data
   node ../pipeline-run.js --session DEMO-SAMPLE-001
   ```
3. Show the pre-generated report while explaining what would happen live.
4. Segue:
   > "Let me show you a session we captured earlier today -- the full
   > pipeline worked exactly as I described."

### Pre-Demo Safety Net

Before the presentation, create a backup session:

```bash
# Run the E2E test to create a known-good session
bash scripts/test/test-e2e-pipeline.sh --no-cleanup

# Note the session ID -- this is your backup
echo "Backup session: E2E-TEST-<timestamp>"
```

This gives you a completed session with report that you can show if the
live demo fails.

---

## Timing Guide

| Segment | Duration | Cumulative |
|---------|----------|------------|
| Opening | 0:30 | 0:30 |
| A: Badge photo | 0:30 | 1:00 |
| B: Start session | 0:15 | 1:15 |
| C: V1 demo (XDR + Endpoints + Risk) | 5:00 | 6:15 |
| D: End session | 0:30 | 6:45 |
| Real-time analysis | 2:00 | 8:45 |
| Generated report | 2:00 | 10:45 |
| Follow-up email | 1:00 | 11:45 |
| Analytics dashboard | 1:00 | 12:45 |
| Q&A buffer | 2:15 | 15:00 |

---

## Closing

**TALKING POINT:**

> "That's BoothApp. Badge scan to personalized AI follow-up in under
> 5 minutes. Every click, every word, every screenshot -- captured and
> analyzed automatically. No more lost business cards, no more generic
> follow-ups, no more 'I think they were interested in endpoint security.'
> The AI knows exactly what they saw and what they care about. Questions?"
