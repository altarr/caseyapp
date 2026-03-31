# Batch Session Analysis API

## Goal
Add POST /api/analyze-batch and GET /api/analyze-status endpoints to the presenter server for reprocessing multiple sessions after improving analysis prompts.

## Success Criteria
1. POST /api/analyze-batch accepts { session_ids: ["id1", "id2", ...] }
2. Each session is queued for analysis (non-blocking)
3. Returns { queued: N, already_analyzed: M, errors: [] }
4. GET /api/analyze-status returns progress for the current/last batch
5. Integrates with existing analysis/lib/pipeline.js and analysis/lib/s3.js
6. Tests pass
