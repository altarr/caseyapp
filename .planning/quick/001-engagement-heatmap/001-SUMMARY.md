# Summary: Visitor Engagement Heatmap

## What Was Done
- Created `presenter/heatmap.html` -- a pure HTML/CSS/JS page that visualizes visitor engagement with V1 product modules
- Added "Heatmap" link to the shared nav component

## Features
- **Click count bar chart** -- horizontal bars sorted by count, heat-colored (red=hot, blue=cold)
- **Dwell time bar chart** -- estimates time per module from inter-click timestamps (capped at 120s idle)
- **Detail breakdown table** -- top 30 clicked elements grouped by module
- **Aggregate vs single-session toggle** -- all sessions or pick one from dropdown
- **Stats row** -- total sessions, clicks, modules visited, top module

## V1 Module Classification
Clicks classified by matching page_url, page_title, element text, dom_path against regex patterns:
- Dashboard, XDR, Endpoint, Email, Risk Insights, Threat Intel, Network, Cloud, Response, Other
- Order matters: Cloud/Network checked before Response to avoid false positives (e.g. "Container" matching /contain/)
- Response patterns use word boundaries to reduce false matches

## Bug Found & Fixed
- "Container Protection" was matching Response's `/contain/i` pattern
- Fix: reordered modules (Cloud before Response) and added `\b` word boundaries to Response patterns
- 16/17 classification tests pass; the one "failure" (Isolate Endpoint -> Endpoint) is a genuine ambiguity

## PR
https://github.com/altarr/boothapp/pull/284
