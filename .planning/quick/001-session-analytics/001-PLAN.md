# Session Analytics Dashboard

## Goal
Add presenter/analytics.html that shows aggregate statistics across all sessions with charts, scores, and date range filtering.

## Success Criteria
1. Page loads session data from /api/sessions
2. Bar chart: total sessions by day (Chart.js CDN)
3. Displays average session duration
4. Horizontal bar chart: most demonstrated products
5. Shows average engagement/coverage/follow-up scores
6. Lists top visitor companies
7. Shows peak hours (when most demos happen)
8. Calculates success rate (sessions with high engagement)
9. Date range filter: today, this week, all time
10. Dark theme matching existing presenter pages (#0d1117 palette)

## Approach
- Create presenter/analytics.html as a single self-contained page
- Add /api/sessions endpoint to server.js that lists sessions from S3
- Use Chart.js from CDN for bar charts
- Follow same auth pattern as sessions.html (BoothAuth + API URL config)
- Compute all analytics client-side from the session list + summary.json data
