# Demo Script

## Goal
Create `scripts/run-demo.sh` - a self-contained demo script that automates the full boothapp pipeline flow with inline sample data and clear echo statements.

## Context
- `scripts/run-demo-simulation.sh` already exists with 230+ lines, CLI args, multiple modes
- The new script should be simpler, focused on "run once and see it work"
- Must follow DATA-CONTRACT.md schemas

## Success Criteria
1. Script at `scripts/run-demo.sh` is executable
2. Creates session via Lambda invoke
3. Uploads sample click data to S3
4. Uploads sample audio transcript to S3
5. Marks session as ended (status=completed + end.json)
6. Waits for watcher to process (polls for output/summary.json)
7. Prints the output summary URL
8. Sample data is inline (no external files)
9. Clear echo statements showing each step
10. Self-contained (only requires AWS CLI + jq)
