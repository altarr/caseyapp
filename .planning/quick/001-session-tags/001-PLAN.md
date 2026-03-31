# Session Tag System

## Goal
Add a tagging system for sessions. Users can add/remove custom labels (e.g., 'hot-lead', 'follow-up-needed', 'competitor-mention'). Tags stored in metadata.json under 'tags' array. Presenter shows tags as colored pills on session cards. Filter by tag on the landing page.

## Success Criteria
- [ ] Tags stored in metadata.json under 'tags' array in S3
- [ ] API endpoints: GET tags, PUT/add tag, DELETE/remove tag for a session
- [ ] Presenter sessions.html shows tags as colored pills on each session row
- [ ] Tag filter UI on the landing page to filter sessions by tag
- [ ] Tags are editable inline from the sessions page (add/remove)
- [ ] Consistent color mapping for tags (deterministic hash-based)

## Implementation
1. Add API routes: PUT /api/sessions/:id/tags (add), DELETE /api/sessions/:id/tags/:tag (remove)
2. S3Cache: add methods to read/write tags in metadata.json
3. sessions.html: render tag pills, add tag input, add filter bar
4. Verify with server test
