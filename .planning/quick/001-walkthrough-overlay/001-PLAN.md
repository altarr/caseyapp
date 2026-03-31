# Walkthrough Overlay for Session Viewer

## Goal
Add a guided tour overlay to the session-viewer page that walks judges/users through each analysis section with tooltip explanations. Triggered by a "Walkthrough" button in the topbar.

## Success Criteria
1. "Walkthrough" button visible in session-viewer topbar
2. Clicking it starts a step-by-step tour highlighting: Executive Summary, Key Interests, Follow-up Actions, Key Moments
3. Each step shows a tooltip explaining what the section is and why it matters
4. CSS transitions for smooth highlight/tooltip animations
5. z-index overlay dims everything except the highlighted section
6. Next/Previous/Close controls on each tooltip
7. Works on desktop (mobile not required for demo)
8. Does not break existing session-viewer functionality
