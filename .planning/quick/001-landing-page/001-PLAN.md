# Landing Page for BoothApp Presenter

## Goal
Create a polished landing page at `presenter/index.html` as the main demo entry point with logo, real-time session stats, quick-action buttons, team credits, and dark gradient theme.

## Success Criteria
1. Large BoothApp logo and "AI-Powered Demo Capture" tagline
2. Real-time session status (active/completed counts from /api/sessions) auto-refreshing every 5s
3. Quick-action buttons: Start New Session, View Sessions, Live Monitor, Admin Panel
4. Team credits section
5. Dark gradient theme matching existing UI
6. Existing session dashboard moved to session.html, links updated

## Plan
1. Move current `presenter/index.html` -> `presenter/session.html`
2. Update references in `sessions.html` and `live.html` to point to `session.html`
3. Create new `presenter/index.html` landing page
4. Verify all links work
