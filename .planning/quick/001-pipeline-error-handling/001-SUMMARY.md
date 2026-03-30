# Pipeline Error Handling — Summary

## What Changed

### analysis/pipeline-run.js
- Each pipeline step (fetch, correlate, write-timeline, analyze, render) wrapped in try-catch
- `withRetry(label, fn)` — exponential backoff (1s/2s/4s, 3 attempts) for S3 reads/writes
- `checkTimeout(stepName)` — 120s total pipeline budget, checked before each step
- Error collector array written to `output/errors.json` in S3 at pipeline end
- `buildFallbackSummary()` — writes a placeholder summary.json + follow-up.json when Claude analysis fails, so downstream consumers (render-report, SDR dashboard) always have data
- Analyze and render step timeouts are dynamically clamped to remaining budget

### analysis/lib/pipeline.js
- 120s timeout on the spawned pipeline-run.js process (SIGTERM on expiry)
- Proper cleanup: `settled` flag prevents double-resolve on timeout+close race

### analysis/test/pipeline-error-test.js (new)
- 20 assertions covering: retry success/failure/exhaustion, fallback summary fields, timeout detection, error payload structure

## Verified
- All 20 new test assertions pass
- All 31 existing correlator test assertions pass
- Both files pass `node -c` syntax check
