# Demo Script — Summary

## What was done
- Created `scripts/run-demo.sh` — self-contained 6-step demo script
- All sample data inline (clicks, transcript, metadata)
- Clear `[Step N/6]` echo statements at each stage
- Follows DATA-CONTRACT.md schemas exactly
- Lambda invoke with fallback to direct S3 upload
- Polls for watcher output with timeout and troubleshooting hints
- PR #231 created on feat/demo-script branch

## Design decisions
- Kept simpler than `run-demo-simulation.sh` (no CLI args, no --no-wait, no --lambda-invoke flags) — this is the "just run it" experience
- 5 clicks instead of 7 (enough to show XDR + Endpoint + Email flow without being verbose)
- 12 transcript entries (realistic 3-min conversation)
- 5-min timeout (vs 10-min in simulation script) — demo should be faster
- Prints S3 console URL at the end for easy browser access to HTML report
