# Workstream D: Backend Infrastructure

## Owner Pool
CCC workers assigned to `infra/` only touch files in this directory.

## What This Does
Manages all cloud resources and V1 tenant lifecycle for booth demos:
1. V1 tenant pool — provision, warm, claim, preserve, expire
2. AWS S3 session storage — bucket structure, lifecycle policies
3. Session orchestration — coordinate start/stop across extension + audio
4. Demo PC polling service — S3-based command queue for each demo PC

## Outputs
- V1 tenants (provisioned and ready)
- S3 buckets (configured with proper structure)
- `v1-tenant/tenant.json` in each session folder
- Session commands in S3 for demo PCs to poll

## Inputs
- Session creation events (from Android app / dispatcher)
- Session end events (from Android app)
- V1 provisioning API / automation

## Tasks
See `.claude-tasks/` for task files prefixed with `inf-`

## Key Decisions
- V1 tenant pool: 6 active + 6 warming + 3 buffer = 15 total
- Tenants preserved 30 days after demo
- Auto-replenish: start provisioning replacement as soon as tenant is claimed
- S3 session folders created by infra, populated by other workstreams
- Demo PC polls S3 every 1s for session start, every 5s for session end
- AWS profile: `hackathon` (us-east-1, account 752266476357)
- Must have load simulation tests before any conference
- Must handle provisioning failures gracefully (retry, alert, never run out)
