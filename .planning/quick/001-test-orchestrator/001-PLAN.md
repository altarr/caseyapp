# Plan: Improve test-orchestrator.js to test Lambda E2E

## Goal
Rewrite test-orchestrator.js to invoke the Lambda handler (index.js) rather than calling orchestrator functions directly. This tests the full HTTP routing + JSON parsing + orchestrator + S3 path.

## Success Criteria
1. Test calls Lambda handler with HTTP events (POST /sessions, POST /sessions/:id/end, GET /sessions/:id)
2. Verifies S3 metadata.json exists after createSession
3. Verifies commands/start.json written after createSession
4. Verifies commands/end.json written after endSession
5. Verifies metadata status=ended after endSession
6. Uses AWS SDK v3 for S3 verification
7. Exit 0 on pass, non-zero on fail
8. Branch, commit, push, PR to main
