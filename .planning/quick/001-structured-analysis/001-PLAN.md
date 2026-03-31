# Plan: Structured Claude Analysis Output

## Goal
Improve analysis/analyze.py Claude analysis output with standardized field names
and JSON schema validation.

## Success Criteria
- [x] summary.json includes: visitor_name, products_demonstrated, key_interests, follow_up_actions, demo_duration_seconds
- [x] engines/prompts.py updated with structured output prompts using exact field names
- [x] engines/validator.py validates output against JSON schema
- [x] Backward compatibility: analyzer falls back gracefully if LLM returns old field names
- [x] Tests cover all new fields and validator behavior
- [x] Branch, commit, push, PR to main
