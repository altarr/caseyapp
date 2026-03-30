# Demo Walkthrough Script

## Goal
Create `scripts/demo-walkthrough.sh` that simulates a complete end-to-end demo session for trade show prep — uploads realistic fake data to S3, triggers the analysis pipeline, and waits for output.

## Success Criteria
1. Script creates a session with realistic metadata (visitor name, company, SE name, timestamps)
2. Uploads clicks.json matching DATA-CONTRACT.md schema (with V1 page URLs, dom_paths, coordinates)
3. Uploads transcript.json matching DATA-CONTRACT.md schema (realistic SE/visitor dialogue about V1)
4. Sets metadata status=completed to trigger the watcher pipeline
5. Polls S3 for output/summary.html with timeout and progress feedback
6. Uses infra/config.js values (bucket, region, profile) as source of truth
7. Prints session URL and verification commands on completion
