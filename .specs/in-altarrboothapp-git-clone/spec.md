A spec already exists at `boothapp/.specs/session-review-ui/spec.md`. It's comprehensive and aligns well with the task request. Comparing it against my research:

**The existing spec is solid.** It covers all 6 requirements from the task request:
1. Session ID via URL param -- yes
2. Fetch summary.json + summary.html from S3 -- yes
3. HTML report in iframe -- yes
4. Key metrics display -- yes
5. Approve & Send placeholder -- yes
6. Dark theme -- yes (references dashboard.html theme, though the task says "matching the landing page" i.e. `demo/index.html`)

Two minor gaps vs the task request:
- The task says "dark theme matching the landing page" (`demo/index.html`), but the spec references `analysis/dashboard.html` theme. The landing page uses `#0d1117`/`#161b22` which is the same palette, so this is cosmetic.
- The task says "PR to main" -- the spec doesn't mention branching/PR strategy, but that's implementation workflow, not spec content.

No TODO.md exists in the boothapp repo. The spec is already written and complete. The next logical step is to implement it -- but the task request only asked to "write a structured spec.md." 

The spec at `boothapp/.specs/session-review-ui/spec.md` is complete and ready for implementation. No changes needed.
