# Plan: validate-session.sh

## Goal
Create `scripts/validate-session.sh` that validates a completed S3 session has all required artifacts with correct structure.

## Success Criteria
1. Takes session_id as argument, exits 0 (valid) or 1 (invalid)
2. Validates metadata.json exists and has required fields (session_id, visitor_name, started_at, ended_at, status)
3. Validates clicks/clicks.json exists and is valid JSON
4. Validates at least one screenshot exists in screenshots/
5. Validates transcript/transcript.json exists and is valid JSON
6. Validates output/summary.html exists
7. Prints clear pass/fail output per check
8. Follows existing script conventions (AWS profile, bucket, helper functions)
