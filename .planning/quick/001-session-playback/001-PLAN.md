# Session Recording Playback

## Goal
Create a session recording playback page that parses timeline.json and replays sessions in real-time with transcript entries appearing at actual timestamps, click events triggering screenshot display, and analysis appearing at the end. Speed controls: 1x, 2x, 4x. Play/pause button.

## Success Criteria
- [ ] Parses timeline.json (unified timeline from correlator) as primary data source
- [ ] Replays session events in real-time at their actual timestamps
- [ ] Transcript entries appear progressively as playback reaches their timestamp
- [ ] Click events trigger screenshot display (S3 real or mock browser frame)
- [ ] Analysis/summary cards appear at the end of playback (not before)
- [ ] Speed controls: 1x, 2x, 4x buttons with visual active state
- [ ] Play/pause button with keyboard shortcut (Space)
- [ ] Timeline scrubber for manual seeking
- [ ] Falls back to sample data when no session ID provided
- [ ] Matches existing dark theme design language

## Approach
Enhance `demo/replay/index.html` to add:
1. timeline.json loading (alongside existing separate-file loading)
2. Speed control buttons (1x, 2x, 4x)
3. Progressive transcript reveal (entries hidden until their timestamp)
4. Deferred analysis section (shown only after playback reaches end)
