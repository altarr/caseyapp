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
