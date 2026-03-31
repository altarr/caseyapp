# Products Demonstrated Section Enhancement

## Goal
Replace the simple product badge list in the analysis HTML report with rich product cards parsed from clicks data, showing product name, click count, and approximate time spent.

## Success Criteria
1. Clicks data (clicks.json) is loaded during report rendering
2. Unique V1 page URLs are extracted and grouped by top-level product path
3. Each product displayed as a card with: product name, click count, time spent
4. Cards sorted by time spent descending
5. Existing product badges still render as fallback when no clicks data exists
6. Test render produces correct output with sample data
