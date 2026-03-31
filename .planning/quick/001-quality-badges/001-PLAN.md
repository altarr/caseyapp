# Session Quality Badge System

## Goal
Add Gold/Silver/Bronze quality badges to session cards (sessions.html) and session viewer header (session-viewer.html) based on analysis quality metrics.

## Success Criteria
1. Badge tiers: Gold (score 8+, 5+ products, 5+ follow-ups), Silver (score 6-7, 3+ products), Bronze (score 4-5)
2. Badges displayed on session cards in sessions.html
3. Badge displayed in session-viewer.html header (visitor card area)
4. CSS-only metallic gradient design (no images)
5. No sessions without analysis = no badge shown

## Implementation
1. Add CSS for metallic gradient badges (gold/silver/bronze) to both files
2. Add `computeQualityBadge(summary)` function that checks score, products, follow-ups
3. sessions.html: fetch summary.json per session to determine badge, display in table
4. session-viewer.html: use already-loaded summary data to show badge next to score
