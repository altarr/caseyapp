# Visitor Engagement Heatmap

## Goal
Add a new presenter page that parses click events from session data and displays a visual heatmap showing which Vision One product areas got the most visitor attention.

## Success Criteria
1. Parses clicks.json events and categorizes them by V1 module (Dashboard, XDR, Endpoint, Email, Risk Insights, Threat Intel, Response)
2. Horizontal bar chart showing click count per module
3. Time spent per module (estimated from click timestamps)
4. Pure HTML/CSS/JS -- no external charting libraries
5. Consistent with existing presenter dark theme and nav
6. Loads data from S3 using same auth pattern as other pages
7. Supports both single-session and aggregate (all sessions) views

## Approach
- New file: `presenter/heatmap.html`
- Add to nav links
- Classify clicks by matching page_url, page_title, dom_path, element text against V1 module patterns
- Render horizontal bars with CSS (no Chart.js needed)
- Time-between-clicks approximation for dwell time per module
