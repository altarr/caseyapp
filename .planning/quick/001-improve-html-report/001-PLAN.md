# Improve HTML Report Template

## Goal
Transform the analysis pipeline HTML report into a presentation-quality document with Trend Micro branding that a sales engineer would proudly hand to a VP of Security.

## Success Criteria
1. Trend Micro red (#D32F2F) and black branding throughout
2. Inline SVG of the Trend Micro logo (actual logo, not placeholder globe)
3. Executive summary section at top with 3-4 key insight cards
4. Detailed timeline section with timestamps showing what was demoed
5. Recommended next steps section with actionable follow-ups
6. Clean typography with system fonts
7. Responsive layout
8. Print-friendly CSS
9. Report renders correctly with existing test data (sample-session)

## Approach
- Replace templates/report.html with a redesigned template
- Update render-report.js to add new placeholders (insight_cards)
- Keep all existing {{placeholder}} contracts working
- Verify with sample data render
