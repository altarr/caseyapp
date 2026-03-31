# Summary: correlator-error-handling

## What was done
Added defensive error handling to `analysis/lib/correlator.js` for malformed click and transcript data:

1. **`parseOffset()`** - now returns `NaN` for non-string or empty inputs instead of throwing `TypeError`
2. **Click event builder** - changed from `.map()` to `.reduce()`, skips entries with missing/invalid `timestamp` and logs a warning
3. **Speech event builder** - same pattern, skips entries with `NaN` offset from `parseOffset()` and logs a warning
4. **5 new test cases** (Tests 9-13) covering: missing click timestamps, missing transcript timestamps, mixed valid/invalid, clicks without `events` array, transcript without `entries` array

## Results
- All 62 tests pass (47 existing + 15 new assertions across 5 new test cases)
- No breaking changes to existing behavior
- PR: https://github.com/altarr/boothapp/pull/114
