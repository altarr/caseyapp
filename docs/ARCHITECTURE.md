# BoothApp System Architecture

BoothApp captures booth demo interactions and produces AI-driven session reports.
Five components communicate through S3 as the shared data plane.

## Components

### Chrome Extension (`extension/`)
Records clicks, navigation events, and periodic screenshots in the browser.
Events are timestamped, buffered locally, then flushed to S3 under the
active session prefix. The popup UI shows session status and S3 config.

### Audio Recorder (`audio/`)
Captures microphone input for the session duration. Audio segments upload
to S3 alongside click and screenshot data so the analysis pipeline can
correlate spoken commentary with on-screen actions.

### Session Orchestrator (`infra/`)
AWS Lambda that manages session lifecycle (start, stop, status). Writes
`active-session.json` to S3 so capture components know which session is
live. Session metadata (timestamps, participant info) is stored as JSON.

### Session Watcher & Analysis Pipeline (`analysis/`)
The watcher polls S3 every 30s for completed sessions. When one is
found it triggers the pipeline: correlator merges clicks, screenshots,
and transcript by timestamp, then Claude analyzes the unified timeline
and generates a personalized HTML report with follow-up recommendations.
Output artifacts are written back to the session's S3 prefix.

## Data Flow

```
Browser (clicks + screenshots) --\
                                  +--> S3 session prefix
Microphone (audio segments) ----/          |
                 ^                    Watcher (polls)
                 |                         |
         Session Orchestrator         Pipeline --> Claude --> Report
         (Lambda lifecycle)
```

## Key Design Decisions

- **S3 as shared bus** -- all components read/write S3, no direct
  service-to-service calls during capture.
- **Timestamps everywhere** -- every click, screenshot, and audio chunk
  carries a UTC timestamp for exact ordering during correlation.
- **Stateless orchestrator** -- session state lives in S3, not in Lambda.
