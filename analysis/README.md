# Workstream C: Post-Demo Analysis & Reporting

## Owner Pool
CCC workers assigned to `analysis/` only touch files in this directory.

## What This Does
After a demo session ends and data is uploaded to S3, this pipeline:
1. Reads transcript + clicks + screenshots from S3
2. Correlates audio timestamps with click timestamps
3. Claude analyzes everything: what was shown, visitor interest signals, questions asked
4. Generates an HTML summary report + structured JSON
5. Generates follow-up recommendations for SDR team

## Pipeline Components

- **watcher** (`watcher.js`) — Polls S3 every 30s for completed sessions. A session is ready when `metadata.json` shows `status: completed` and both `clicks.json` and `transcript.json` exist. Claims the session by writing an `.analysis-claimed` marker, then spawns `pipeline-run.js`. Exposes a health-check endpoint on port 8090.
- **correlator** (`lib/correlator.js`) — Pure function that merges click events and transcript segments into a single unified timeline sorted by timestamp. No I/O; receives data from the pipeline runner.
- **analyzer** (`analyze.py` + `engines/`) — Two-pass Claude analysis: first extracts facts (what was shown, questions asked, interest signals), then generates contextual follow-up recommendations. Outputs `summary.json`, `summary.html`, and `follow-up.json`.
- **pipeline-run** (`pipeline-run.js`) — Orchestrates end-to-end processing for a single session. Fetches clicks and transcript from S3, calls the correlator to build a timeline, invokes the analyzer, and writes all output artifacts back to the session's S3 folder.

The pipeline runs automatically: watcher detects → pipeline-run orchestrates → correlator merges → analyzer produces the final report.

## Base
Adapted from recording-analyzer (template-based analysis engines) and v1-helper (HTML report generator).

## Outputs (to S3 session folder)
- `output/summary.html` — self-contained HTML report, email-ready
- `output/summary.json` — see DATA-CONTRACT.md for schema
- `output/follow-up.json` — see DATA-CONTRACT.md for schema

## Inputs (from S3 session folder)
- `metadata.json` — visitor name, SE name, timestamps
- `transcript/transcript.json` — what was said
- `clicks/clicks.json` — what was clicked
- `screenshots/*.jpg` — what was shown on screen
- `v1-tenant/tenant.json` — link to visitor's preserved V1 tenant

## Tasks
See `.claude-tasks/` for task files prefixed with `ana-`

## Key Decisions
- Claude API (via RONE AI endpoint) for analysis — not local LLM
- Two-pass analysis: (1) factual extraction, (2) contextual recommendations
- HTML report must be self-contained (inline CSS/images, no external deps)
- Include clickable screenshots in the report (key moments)
- Include V1 tenant link prominently
- Analysis runs automatically when all session files are present in S3
- Trigger: S3 event notification or polling for session completion
