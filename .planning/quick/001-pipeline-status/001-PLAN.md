# Pipeline Status Tracking

## Goal
Add real-time pipeline status tracking so the presenter can poll `sessions/<id>/output/status.json` and show a live progress bar during the demo.

## Success Criteria
1. `analysis/lib/status.js` exists with functions to update and read status
2. Status JSON has fields: stage, progress_pct, started_at, estimated_completion
3. Valid stages: correlating, analyzing, generating_report, complete
4. pipeline-run.js calls status updates at each stage transition
5. Status is written to S3 at `sessions/<id>/output/status.json`
6. Tests pass
