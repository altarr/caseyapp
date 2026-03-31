# Mobile Responsive Presenter Pages

## Goal
Add responsive mobile CSS for all presenter pages (sessions, session-viewer, analytics, admin) so they work well on phone-width screens (<768px).

## Success Criteria
1. Cards stack vertically instead of grid on mobile
2. Tables have horizontal scroll and full width
3. Touch targets are minimum 44px
4. Nav uses hamburger menu (already implemented in nav.js)
5. Non-essential table columns hidden on mobile
6. Larger font sizes for readability
7. Fullscreen toggle button on session viewer
8. All four pages (sessions, session-viewer, analytics, admin) look good at phone width

## Approach
- Create `presenter/styles/mobile.css` with media queries for <768px
- Add `<link>` to all presenter pages
- Add fullscreen toggle button to session-viewer.html
- Test with actual width constraints
