# ROI Calculator — Summary

## What Was Done
- Created `presenter/roi-calculator.html` — interactive XDR ROI calculator page
- Added ROI Calculator to nav component (`presenter/components/nav.js`)
- Added ROI Calculator to dashboard quick-nav links (`presenter/index.html`)

## Features
- Team size slider (1-50 analysts) with real-time recalculation
- Three ROI category cards with visual comparison bars:
  - Investigation time saved (45min manual vs 5min XDR)
  - MTTR reduction (287hrs vs 24hrs)
  - Breach prevention (risk-adjusted cost savings)
- Total annual savings banner
- Expandable assumptions section with all benchmark sources
- Dark theme matching existing presenter pages
- Mobile responsive

## Verification
- HTML structure validated (all tags balanced, IDs match)
- JS calculations tested for team sizes 1, 5, 10, 25, 50
- Example: 10-person team = ~$2.9M annual savings
