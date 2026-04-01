# Demo Landing Page

## Goal
Create a presenter-facing demo status page at `extension/demo.html` that shows real-time session progress by polling `active-session.json` from S3.

## Success Criteria
1. Dark theme with TrendAI red (#D32F2F) accents
2. Shows session status: waiting / recording / processing / complete
3. Shows visitor name from badge scan
4. Shows click count
5. Shows recording duration timer (live counting)
6. Shows processing spinner when analyzing
7. Shows final summary card when complete
8. Polls active-session.json from S3 every 3 seconds
9. Pure HTML/CSS/JS, no frameworks
10. PR created from feature branch to main
