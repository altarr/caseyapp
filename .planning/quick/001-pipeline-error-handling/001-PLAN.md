# Pipeline Error Handling

## Goal
Add robust error handling to analysis/lib/pipeline.js and analysis/pipeline-run.js: try-catch per step, errors written to output/errors.json, retry with exponential backoff for S3/Bedrock calls, 120s pipeline timeout, fallback summary on failure. Must not break existing flow.

## Success Criteria
1. Each pipeline step (fetch, correlate, write timeline, analyze, render) wrapped in try-catch
2. Errors collected and written to `sessions/<id>/output/errors.json` in S3
3. S3 and Bedrock calls retry with exponential backoff (3 attempts, 1s/2s/4s)
4. 120s total pipeline timeout (AbortController or similar)
5. On fatal failure, a fallback summary.json is written so downstream consumers aren't left hanging
6. Existing happy-path flow unchanged
7. Tests pass
