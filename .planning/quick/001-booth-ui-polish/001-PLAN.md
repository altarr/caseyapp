# Plan: Booth UI Polish & Missing Pieces

## Goal
Complete all 5 deliverables from the original request to presentation quality, fixing gaps left by prior PRs.

## Success Criteria
1. `node -e "require('./analysis/engines/templates')"` exits 0
2. HTML report template has TM red/black branding, inline SVG logo, exec summary cards, timeline, next steps, print CSS
3. demo/landing/index.html renders full-screen dark TM branded kiosk with animations, counter, QR placeholder
4. demo/replay/index.html renders timeline scrubber, screenshot panel, transcript panel, summary cards from sample-data.js
5. extension/popup.html has TM branding, status indicators, click/screenshot counters, S3 status, settings toggle
6. scripts/test/test-e2e-pipeline.sh is executable and has correct structure

## Gaps Found
- analysis/engines/templates/ has no index.js -- require() test fails
- Need to verify all other test criteria pass
