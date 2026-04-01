# Live Session Status Page

## Goal
Create a real-time session status page at `presenter/live.html` that auto-discovers the active session from S3 and displays booth-friendly live metrics.

## Success Criteria
1. Page polls S3 every 5 seconds for the active session (most recent `in_progress`/`recording` session)
2. Displays: current visitor name, session duration timer, live click count, recording status indicator
3. Large clean font suitable for booth monitor display
4. Dark theme with TrendAI red (#D71920) accents
5. No manual session ID entry required -- auto-discovers active session via API
6. Timer ticks every second between polls
7. Graceful "waiting for session" state when no active session exists
