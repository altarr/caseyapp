# Webhook Notification Enhancement - Summary

## What Changed
- `analysis/lib/notify.js`: Added `session_score` (numeric 1-10 from summary.json) and `products_demonstrated` (string array from summary.json) to the webhook payload
- `analysis/test/notify-test.js`: Added `session_score` to sample data, updated required field checks, added tests for new fields and graceful defaults

## Webhook Payload (after)
```json
{
  "session_id": "...",
  "visitor_name": "...",
  "company": "...",
  "session_score": 8,
  "score": "high",
  "executive_summary": "...",
  "products_demonstrated": ["XDR", "Endpoint Security"],
  "completed_at": "...",
  "report_url": "..."
}
```

## Backward Compatibility
- `score` (high/medium/low) retained for existing consumers
- New fields added alongside, not replacing
