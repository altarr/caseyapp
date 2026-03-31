# Sample Session Generator

## Goal
Create `scripts/generate-sample-session.sh` that generates realistic demo data in S3 to trigger the full analysis pipeline, with randomized personas and realistic V1 interaction patterns.

## Success Criteria
- [ ] Script at scripts/generate-sample-session.sh
- [ ] 5 personas randomized: CEO, VP Security, CISO, SE Manager, IT Director
- [ ] metadata.json matching DATA-CONTRACT.md schema
- [ ] clicks.json with 8-12 realistic V1 clicks (XDR, Search, Workbench, Risk Insights)
- [ ] transcript.json with 20-30 dialogue entries (SE explains, visitor asks about security posture, competitive displacement, cloud coverage)
- [ ] Realistic timestamps spanning 10-20 minutes
- [ ] Usage: bash scripts/generate-sample-session.sh [visitor-name]
- [ ] Watcher auto-detects and runs full Bedrock analysis
