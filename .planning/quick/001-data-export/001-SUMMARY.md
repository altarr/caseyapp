# Data Export -- Summary

## What was done
Added three data export buttons to `presenter/analytics.html`:

1. **Export All Sessions (JSON)** -- Downloads full session objects (metadata + analysis + feedback) as formatted JSON
2. **Export Summary (CSV)** -- One row per session with: session_id, visitor_name, company, title, date, duration, scores (session/coverage/follow-up), products, interests, actions, priority
3. **Export Metrics (PDF)** -- Captures the dashboard DOM via html2canvas, renders to multi-page A4 landscape PDF with jsPDF

## Technical details
- Added html2canvas 1.4.1 and jsPDF 2.5.1 via CDN
- New "Data Export" bar placed below existing CRM export bar, same styling
- All exports respect active date range filter
- PDF handles multi-page overflow by slicing the canvas
- Session count badge shows "X analyzed / Y total sessions"

## PR
https://github.com/altarr/boothapp/pull/296
