# Plan: Improve Analysis Prompts

## Goal
Improve `analysis/engines/prompts.py` to produce better Claude analysis output with structured V1 feature identification, visitor technical level assessment, engagement rating, and actionable follow-up items with owners.

## Success Criteria
- [ ] System prompt instructs Claude to identify specific V1 features (XDR, Endpoint Security, Cloud Security, Email Security, etc.)
- [ ] System prompt instructs Claude to note visitor technical level (executive/technical/hands-on)
- [ ] System prompt instructs Claude to rate engagement 1-5
- [ ] System prompt instructs Claude to list specific follow-up actions with owners
- [ ] Response must be valid JSON
- [ ] Branch created, committed, pushed, PR to main
