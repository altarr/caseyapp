# Meeting Prep Generator

## Goal
Add a meeting prep page to the presenter that generates a pre-meeting brief for follow-up calls after booth demos. The brief synthesizes analysis data (summary.json, follow-up.json, feedback.json, notes.json, metadata.json) into a one-page actionable document.

## Success Criteria
1. New `meeting-prep.html` page accessible from nav or session viewer
2. Loads session data from S3 via existing API
3. Generates a structured pre-meeting brief with: visitor info, demo recap, key interests, recommended talking points, objection prep, and next steps
4. Print-friendly layout for SDRs to use before the call
5. Works with existing session data contract (no backend changes needed)
