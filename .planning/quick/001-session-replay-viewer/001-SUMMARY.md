# Session Replay Viewer - Summary

## What was done
- Created `demo/replay/index.html` -- interactive session replay viewer
- Created `demo/replay/sample-data.js` -- mock session data for offline testing

## Features
- Timeline scrubber with click markers, play/pause, keyboard shortcuts (Space, Arrow keys)
- Left panel: mock browser showing click screenshots at correct timestamps
- Right panel: transcript with active line highlighting and auto-scroll
- Bottom: horizontal scrollable summary cards (executive summary, products, interests, actions, key moments)
- S3 data loading with configurable bucket/region at top of file
- Falls back to sample data when no session ID provided or S3 unavailable
- Dark theme matching landing page (--bg: #0a0a0f palette)
- Responsive layout with mobile breakpoints at 900px and 600px
- Touch support for mobile scrubbing
