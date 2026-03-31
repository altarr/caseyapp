# Timeline Builder

## Goal
Create `analysis/engines/timeline_builder.py` that builds a visual timeline from `clicks.json` and `transcript.json`. Output: `timeline.json` with unified events sorted by time. Each event: timestamp, type, description, v1_feature. V1 feature mapping in `analysis/config/v1_features.json`.

## Success Criteria
1. `timeline_builder.py` exists in `analysis/engines/`
2. Reads clicks.json and transcript.json
3. Outputs timeline.json with unified events sorted by timestamp
4. Each event has: timestamp, type, description, v1_feature
5. V1 feature mapping loaded from `analysis/config/v1_features.json`
6. All tests pass
