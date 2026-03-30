# Demo Walkthrough Script — Summary

## What Was Done
Created `scripts/demo-walkthrough.sh` — a complete end-to-end demo simulation script for trade show prep.

## Script Features
- Generates a realistic 15-minute V1 demo session with fake but plausible data
- Visitor: "Sarah Chen" from "Meridian Financial Services" (financial services CISO persona)
- 10 click events across Dashboard, Endpoint Security, XDR Workbench, and Administration
- 23 transcript entries with realistic SE/visitor dialogue covering risk scoring, endpoint isolation, XDR correlation, custom detection rules, response playbooks, and licensing
- All data matches DATA-CONTRACT.md schemas exactly
- Sets status=completed to trigger the watcher/analysis pipeline
- Polls S3 for output/summary.html with progress indicators (shows pipeline stage)
- 10-minute timeout with troubleshooting guide on failure
- Flags: `--id` for custom session ID, `--no-wait` to skip polling
- Uses correct config values from infra/config.js (bucket, region, profile)

## Files Changed
- `scripts/demo-walkthrough.sh` (new) — 510 lines
