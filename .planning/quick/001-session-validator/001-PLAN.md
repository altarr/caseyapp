# Session Data Validator

## Goal
Add `infra/validator.js` that validates session data completeness and correctness before analysis starts. Integrate into watcher to gate the pipeline.

## Success Criteria
1. metadata.json validated: session_id, visitor_name, status=completed required
2. clicks.json: events array with >= 1 click
3. transcript.json: entries array with >= 1 entry
4. Each click event has timestamp, url (page_url), and element fields
5. Each transcript entry has timestamp, speaker, and text fields
6. Timestamps are valid ISO dates and chronologically ordered
7. Returns { valid: true/false, errors: [...], warnings: [...] }
8. Integrated into watcher before triggerPipeline call
9. Tests pass

## Approach
- Create `infra/validator.js` as a pure validation module (no S3 deps)
- Accept parsed JSON objects, return validation result
- Integrate in watcher.js: fetch JSON, validate, skip pipeline on failure
- Add unit tests
