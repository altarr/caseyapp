# Quick Setup Page

## Goal
Create presenter/quick-setup.html — a pre-demo checklist page for SEs to verify all booth systems are operational before a visitor arrives.

## Success Criteria
1. Page at presenter/quick-setup.html with dark theme matching existing pages
2. AWS S3 connection test (verify bucket access via listObjectsV2)
3. Chrome extension status check (polls extension ping endpoint)
4. Audio recorder status check
5. Lambda connectivity test (invoke health check)
6. Watcher status check (polls /api/health)
7. Large green "READY" / red "NOT READY" master indicator
8. Individual "Fix" buttons for each failed check
9. Large fonts optimized for quick glancing
10. Auto-refreshes every 10 seconds
