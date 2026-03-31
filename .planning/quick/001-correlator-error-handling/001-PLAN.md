# Plan: correlator-error-handling

## Goal
Add error handling to `analysis/lib/correlator.js` for missing click or transcript data so the correlator degrades gracefully instead of throwing on malformed inputs.

## Success Criteria
1. `correlate()` returns a valid empty-ish result (not throws) when clicks is missing `events` property
2. `correlate()` returns a valid result when transcript is missing `entries` property
3. `correlate()` handles individual click events with missing `timestamp` field
4. `correlate()` handles transcript entries with missing `timestamp` field
5. All existing tests still pass
6. New test cases cover the above edge cases
