# Data Export for Analytics Dashboard

## Goal
Add three data export buttons to the analytics dashboard: Export All Sessions (JSON), Export Summary (CSV), Export Metrics (PDF).

## Success Criteria
1. JSON export button downloads full session data (metadata + summary + feedback) for all filtered sessions
2. CSV export button downloads one row per session with key fields (visitor, company, score, duration, products, interests)
3. PDF export button captures the dashboard as-rendered and downloads as PDF
4. All exports respect the active date filter
5. Buttons are styled consistently with existing export bar
6. No regressions to existing CRM export functionality
