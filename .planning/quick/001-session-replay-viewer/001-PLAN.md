# Session Replay Viewer

## Goal
Create an interactive session replay viewer at `demo/replay/index.html` that renders a timeline-driven playback of a demo session, allowing a VP to scrub through screenshots, transcript, and analysis output.

## Success Criteria
- [ ] Timeline scrubber at top showing session duration
- [ ] Left panel: click screenshots displayed at correct timestamps as user scrubs
- [ ] Right panel: transcript text highlighted to match current timestamp
- [ ] Bottom: summary cards from analysis output
- [ ] Data loaded from S3 session folder (clicks.json, transcript.json, output/summary.json)
- [ ] Configurable S3 bucket/region at top of file
- [ ] Responsive layout, dark theme matching landing page
- [ ] sample-data.js with mock session data for offline testing
- [ ] Opening index.html renders timeline and panels correctly
