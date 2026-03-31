# Webhook Notification System Enhancement

## Goal
Enhance analysis/lib/notify.js webhook payload to include all required fields:
session_id, visitor_name, company, session_score, executive_summary, products_demonstrated.

## Current State
- notify.js already exists with WEBHOOK_URL support and postWebhook()
- Payload is missing: session_score, products_demonstrated
- Uses `score` (high/medium/low) instead of numeric `session_score`
- summary.json from analyzer.py contains session_score (1-10) and products_demonstrated[]

## Changes Required
1. Update buildNotification() to include session_score from summary.json
2. Add products_demonstrated from summary.json
3. Keep backward-compatible fields (score, completed_at, report_url)
4. Add test for the new payload fields

## Success Criteria
- [x] Webhook POST payload includes: session_id, visitor_name, company, session_score, executive_summary, products_demonstrated
- [x] WEBHOOK_URL env var configures the target URL
- [x] Non-blocking: webhook failure doesn't crash the pipeline
- [x] Test validates the payload structure
