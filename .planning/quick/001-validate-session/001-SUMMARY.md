# Summary: validate-session.sh

## What Was Done
Created `scripts/validate-session.sh` -- validates a completed S3 session has all required artifacts.

## Checks Performed
1. metadata.json: exists, valid JSON, has required fields (session_id, visitor_name, started_at, ended_at, status, demo_pc, se_name), status is completed/ended
2. clicks/clicks.json: exists, valid JSON, has click events
3. screenshots/: at least one file present
4. transcript/transcript.json: exists, valid JSON, has entries
5. output/summary.html: exists and is non-empty

## Interface
- Takes session_id as positional arg
- `--verbose` flag for detailed field values
- Exits 0 (all pass) or 1 (any fail)
- Follows existing script conventions (same bucket, AWS profile, pass/fail helpers)
