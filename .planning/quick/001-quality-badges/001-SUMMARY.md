# Session Quality Badges -- Summary

## What Was Done
- Added Gold/Silver/Bronze quality badges based on analysis metrics
- Badge tiers: Gold (score 8+, 5+ products, 5+ follow-ups), Silver (score 6-7, 3+ products), Bronze (score 4-5)
- CSS-only metallic gradient design in shared stylesheet `styles/quality-badges.css`
- Badges appear on session list table and session viewer header
- Server API extended to return `products_count` and `follow_up_count` via `?include=analysis`
- Mobile responsiveness: Quality column hidden on small screens

## Files Changed
- `presenter/lib/sessions.js` -- Added products_count/follow_up_count to analysis enrichment
- `presenter/sessions.html` -- Quality column, badge computation, `?include=analysis` fetch
- `presenter/session-viewer.html` -- Badge in visitor card next to engagement score
- `presenter/styles/quality-badges.css` -- NEW: shared metallic badge styles
- `presenter/styles/mobile.css` -- Hide Quality column on mobile

## PR
- #300: feat/quality-badges
