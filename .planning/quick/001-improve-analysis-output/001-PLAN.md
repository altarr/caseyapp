# Improve Analysis Output

## Goal
Improve the Claude analysis output by filling gaps: add missing `se_name` to summary output, add follow-up.json schema validation, and update tests.

## Success Criteria
- [ ] `se_name` included in `_build_summary_json` output and `SUMMARY_SCHEMA`
- [ ] `FOLLOW_UP_SCHEMA` added to validator.py with `validate_follow_up` / `validate_follow_up_or_raise`
- [ ] `analyze()` validates both summary AND follow-up output
- [ ] Tests cover follow-up validation
- [ ] All existing tests still pass
- [ ] Branch, commit, push, PR to main
