# Session Replay Viewer

## Goal
Add a session replay feature at `presenter/replay.html` that lets judges review demos after the fact by replaying the correlated timeline of clicks + transcript as a horizontal timeline visualization.

## Success Criteria
1. Given a session_id, loads clicks.json + transcript.json + metadata.json (from S3 or demo mode)
2. Displays a horizontal timeline with event markers (clicks = blue, speech = purple)
3. Clicking an event shows: screenshot, click details, transcript at that moment
4. Play button auto-advances through events (1 event per 2 seconds default)
5. Speed controls: 0.5x, 1x, 2x, 5x
6. Current time indicator (playhead) on the timeline
7. Products panel on right showing which V1 module was active at each point
8. Dark theme consistent with existing presenter pages
9. Works in demo mode with sample data (no S3 needed)
