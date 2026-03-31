# Plan: Booth UI Overhaul

## Goal
Create presentation-quality UI components for the BoothApp trade show demo system: improved HTML report template, demo landing page, session replay viewer, Chrome extension popup redesign, and comprehensive E2E integration test.

## Success Criteria
1. `node -e "require('./analysis/templates')"` loads without error (report template has index.js)
2. `demo/landing/index.html` renders full-screen dark theme with Trend Micro branding, no JS errors
3. `demo/replay/index.html` with sample-data.js renders timeline scrubber, screenshot panel, transcript panel
4. Chrome extension popup.html renders cleanly with status indicators, counters, settings gear
5. `scripts/test/test-e2e-pipeline.sh` generates sample session, uploads to S3, validates output, cleans up

## Tasks
- [x] Improve analysis/templates/report.html with Trend Micro branding, executive summary, timeline, next steps
- [x] Create analysis/templates/index.js for Node.js require
- [x] Create demo/landing/index.html booth kiosk screen
- [x] Create demo/replay/index.html session replay viewer with sample-data.js
- [x] Redesign extension/popup.html and extension/popup.js
- [x] Create scripts/test/test-e2e-pipeline.sh
- [x] Verify all success criteria (34/34 render tests pass, 36/36 Python tests pass)
