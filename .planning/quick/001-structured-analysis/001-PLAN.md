# Improve Structured Analysis Output

## Goal
Enhance the Claude analysis pipeline output quality: tighter prompts, stricter validation, better CLI output.

## Success Criteria
- [ ] prompts.py uses explicit JSON schema in system prompts for deterministic output
- [ ] validator.py enforces minItems, minLength, and rejects unknown fields
- [ ] analyze.py prints a cleaner, more complete summary
- [ ] All existing tests pass
- [ ] New tests cover the enhanced validation rules
- [ ] Branch created, committed, pushed, PR to main
