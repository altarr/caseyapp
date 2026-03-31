# Fix Correlator Demo Fallback Data Handling

## Goal
Fix correlator.js to handle variable demo/fallback data formats without crashing, and fix analyze.py to handle empty/failed timeline gracefully.

## Success Criteria
1. Correlator handles clicks as top-level array OR `{ events: [...] }` OR `{ clicks: [...] }`
2. Correlator handles transcript with `entries`, `results`, `items`, or `transcripts` keys, or as flat array
3. Null/undefined checks before accessing .length or iterating arrays
4. Returns empty but valid timeline.json if input data is missing/malformed
5. analyze.py handles empty timeline or correlator failure without crashing
6. All existing tests still pass
7. New tests cover the alternative data formats
