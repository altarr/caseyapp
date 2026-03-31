# Session Notes Feature

## Goal
Add a Notes panel to the session-viewer page where SEs/managers can add free-text notes (follow-up status, deal stage, etc.). Notes persist in S3 at `sessions/<id>/output/notes.json` and survive page reloads.

## Success Criteria
- [ ] Notes panel visible on session-viewer.html below the analysis card
- [ ] Textarea for free-text input with Save button
- [ ] Notes saved to S3 at `sessions/<id>/output/notes.json`
- [ ] Notes loaded on page load (persist across reloads)
- [ ] Matches existing dark theme (uses CSS vars)
- [ ] Save feedback (success/error indicator)
