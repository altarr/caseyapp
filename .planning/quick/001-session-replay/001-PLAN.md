# Session Replay Viewer

## Goal
Create presenter/components/session-replay.html — a session replay viewer that loads clicks.json and screenshots from S3, then plays back the demo as an animated slideshow with click location highlights, DOM path labels, timestamps, and playback controls.

## Success Criteria
1. Given a session ID (query param or prompt), loads clicks.json from S3
2. Loads screenshots referenced in clicks.json from S3
3. Displays each screenshot with red circle at click coordinates
4. Shows DOM path label and timestamp for each click event
5. Auto-advances every 3 seconds with play/pause toggle
6. Previous/next navigation buttons
7. Progress bar at bottom showing current position
8. Dark theme consistent with existing presenter pages
9. Uses BoothAuth for credential gating (same pattern as other pages)
