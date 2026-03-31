# Plan: Email Summary Template Generator

## Goal
Add `analysis/engines/email_template.py` that generates a personalized follow-up email HTML template (`follow-up-email.html`) from summary.json and follow-up.json data. Integrate into the existing analysis pipeline.

## Success Criteria
- [ ] `analysis/engines/email_template.py` exists with `render_follow_up_email(summary, follow_up, metadata)` function
- [ ] Output is a self-contained HTML email using Trend Micro branding/style
- [ ] Email includes: visitor name, products discussed, personalized recommendations, CTA for follow-up meeting
- [ ] `analyze.py` calls the template generator and writes `follow-up-email.html` to output
- [ ] Pipeline test passes with sample data

## Files to Create/Modify
1. **CREATE** `analysis/engines/email_template.py` -- template generator
2. **MODIFY** `analysis/engines/__init__.py` -- export if needed
3. **MODIFY** `analysis/analyze.py` -- call email template generator, write output
4. **MODIFY** `analysis/pipeline-run.js` -- no change needed (Python analyze.py handles it)
