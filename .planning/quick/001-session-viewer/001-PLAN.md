# Session Data Viewer

## Goal
Create presenter/session-viewer.html that displays comprehensive session data for a given session_id.

## Success Criteria
1. URL param ?session=<id> loads session data
2. Visitor info card shows name, company, title from metadata.json
3. Session timeline from clicks.json as vertical scrollable list with timestamps, descriptions, screenshot thumbnails
4. Transcript panel with speaker labels from transcript.json
5. Analysis summary panel from output/summary.json
6. Products demonstrated list from summary.json
7. Follow-up actions list from summary.json
8. Dark theme consistent with existing presenter pages
9. Data fetched from S3 via AWS SDK (same pattern as other pages)
10. Auth gated like other pages
