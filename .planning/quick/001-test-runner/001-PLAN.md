# Comprehensive Test Runner

## Goal
Create `scripts/run-tests.sh` that runs all test suites (unit, integration, e2e, extension, smoke), reports pass/fail per suite with color, shows summary with totals and duration, exits 0 only if all pass.

## Success Criteria
1. Script at scripts/run-tests.sh runs all 5 test suites
2. Each suite: run, capture exit code, display pass/fail with color
3. Summary: total suites, passed, failed, duration
4. Exit 0 only if ALL suites pass
5. --suite flag filters to a single suite
6. --verbose flag for detailed output
7. Gracefully handles missing test directories (skip with warning)
