# 001 — Add Session ID Validation

## Goal
Add input validation to `infra/session-orchestrator/orchestrator.js` to validate `session_id` format before any S3 operations, preventing path traversal and injection attacks.

## Success Criteria
1. `validateSessionId()` function exists and enforces uppercase alphanumeric, 1-20 chars
2. All public functions (`getSession`, `endSession`, `transitionState`, `getSessionState`) call `validateSessionId` before S3 access
3. Invalid session IDs throw with `statusCode: 400`
4. Tests cover valid IDs, empty/null/undefined, lowercase, special chars, path traversal, length limits
5. All existing tests still pass
