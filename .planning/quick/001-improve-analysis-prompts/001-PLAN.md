# Improve Analysis Prompts

## Goal
Enhance analysis/engines/prompts.py to produce better Claude analysis output with V1 feature taxonomy, visitor technical level classification, structured follow-up actions with owners, and 1-5 engagement rating.

## Success Criteria
- [x] System prompt includes V1 feature taxonomy (XDR, Endpoint Security, Cloud Security, Email Security, etc.)
- [x] Visitor technical level classification (executive/technical/hands-on) with evidence
- [x] Engagement rating on 1-5 scale (not 1-10)
- [x] Follow-up actions are structured objects with action, owner (SE/SDR/visitor), and deadline
- [x] All responses must be valid JSON (explicit instruction in prompts)
- [x] HTML report renders new fields (owner badges, deadline, visitor level, 5-step gauge)
- [x] All existing tests pass with updated sample data
- [x] Branch created, committed, pushed
