# Session Replay Viewer - Summary

## What was done
- Created `presenter/components/session-replay.html` - a self-contained session replay viewer
- Added "Replay" link to the sessions.html detail panel for each session

## Features
- Loads clicks.json and screenshots from S3 for any session ID
- Displays screenshots with animated red circle at click coordinates
- Shows DOM path, element text, timestamp, page title, and coordinates for each event
- Auto-advances every 3 seconds with play/pause toggle
- Previous/next buttons with keyboard shortcuts (arrows, space, home, end)
- Clickable progress bar with tick markers for each event
- Preloads adjacent screenshots for smooth transitions
- Dark theme matching existing presenter pages
- Auth gated via BoothAuth (same as other pages)
- Accepts session ID via ?session= query param or manual input
