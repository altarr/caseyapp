# Summary: Email Follow-Up Template Generator

## What Was Done
- Created `analysis/engines/email_template.py` with `render_follow_up_email()` function
- Integrated into `analysis/analyze.py` to auto-generate `follow-up-email.html` alongside existing outputs
- Added 23 tests in `analysis/test/test_email_template.py`

## Key Design Decisions
- Table-based HTML layout for maximum email client compatibility (Outlook, Gmail, etc.)
- TrendAI brand colors (#e94560 gradient header, matching existing email-report.js style)
- Personalized intro paragraph based on visitor interests
- Two CTAs: "Explore Vision One" button + "Schedule a Follow-Up Meeting" outline button
- Pre-built conditional sections to avoid f-string nesting issues
- Graceful degradation: renders sensibly even with minimal/empty data
