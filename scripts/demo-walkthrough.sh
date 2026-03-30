#!/usr/bin/env bash
# demo-walkthrough.sh — End-to-end demo session for trade show prep.
#
# Creates a test session with realistic fake data (metadata, clicks, transcript),
# sets status=completed to trigger the analysis pipeline (watcher.js), and polls
# S3 until output/summary.html appears.
#
# Usage:
#   ./scripts/demo-walkthrough.sh                     # auto-generated session ID
#   ./scripts/demo-walkthrough.sh --id WALK-12345     # custom session ID
#   ./scripts/demo-walkthrough.sh --no-wait           # upload only, don't poll
#
# Requires: aws CLI configured with 'hackathon' profile
set -euo pipefail

# ── Config (from infra/config.js — single source of truth) ───────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"

AWS="aws --profile ${PROFILE} --region ${REGION}"

# ── Args ──────────────────────────────────────────────────────────────────────
SESSION_ID="WALK-$(date +%s)"
WAIT=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)      SESSION_ID="$2"; shift 2 ;;
    --no-wait) WAIT=false; shift ;;
    -h|--help)
      echo "Usage: $0 [--id SESSION_ID] [--no-wait]"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

PREFIX="sessions/${SESSION_ID}"
S3_PREFIX="s3://${BUCKET}/${PREFIX}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── Timestamps ────────────────────────────────────────────────────────────────
START_EPOCH=$(date +%s)
START_TS=$(date -u -d @"${START_EPOCH}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
        || date -u -r "${START_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)

ts_offset() {
  local offset=$1
  date -u -d @$(( START_EPOCH + offset )) +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null \
    || date -u -r $(( START_EPOCH + offset )) +%Y-%m-%dT%H:%M:%S.000Z
}

END_TS=$(ts_offset 900)  # 15-minute demo

echo "================================================================"
echo "  BoothApp Demo Walkthrough"
echo "  Session: ${SESSION_ID}"
echo "  Bucket:  s3://${BUCKET}"
echo "================================================================"
echo ""

# ── 1. metadata.json ─────────────────────────────────────────────────────────
cat > "${TMP}/metadata.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "Sarah Chen",
  "company": "Meridian Financial Services",
  "badge_photo": "badge.jpg",
  "started_at": "${START_TS}",
  "ended_at": "${END_TS}",
  "demo_pc": "booth-pc-3",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "active",
  "upload_complete": false
}
ENDJSON

echo "[1/6] Uploading metadata.json (status=active) ..."
${AWS} s3 cp "${TMP}/metadata.json" "${S3_PREFIX}/metadata.json" --quiet

# ── 2. clicks/clicks.json ────────────────────────────────────────────────────
cat > "${TMP}/clicks.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "events": [
    {
      "index": 1,
      "timestamp": "$(ts_offset 5)",
      "type": "click",
      "dom_path": "div.app-content > nav > a.dashboard",
      "element": {
        "tag": "a",
        "id": "nav-dashboard",
        "class": "dashboard",
        "text": "Dashboard",
        "href": "/app/dashboard"
      },
      "coordinates": {"x": 120, "y": 85},
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    },
    {
      "index": 2,
      "timestamp": "$(ts_offset 45)",
      "type": "click",
      "dom_path": "div.risk-overview > div.risk-score-card",
      "element": {
        "tag": "div",
        "id": "risk-index",
        "class": "risk-score-card",
        "text": "Risk Index: 42",
        "href": null
      },
      "coordinates": {"x": 680, "y": 310},
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-002.jpg"
    },
    {
      "index": 3,
      "timestamp": "$(ts_offset 120)",
      "type": "click",
      "dom_path": "div#menuendpoint_security_operations > span.ant-menu-title",
      "element": {
        "tag": "span",
        "id": "ep-nav",
        "class": "ant-menu-title",
        "text": "Endpoint Security",
        "href": "/app/endpoint-security"
      },
      "coordinates": {"x": 85, "y": 420},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security",
      "page_title": "Vision One - Endpoint Security Operations",
      "screenshot_file": "screenshots/click-003.jpg"
    },
    {
      "index": 4,
      "timestamp": "$(ts_offset 210)",
      "type": "click",
      "dom_path": "table.endpoint-list > tbody > tr:nth-child(3) > td.hostname",
      "element": {
        "tag": "td",
        "id": "",
        "class": "hostname",
        "text": "DESKTOP-MER-0847",
        "href": null
      },
      "coordinates": {"x": 440, "y": 385},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security/endpoint-inventory",
      "page_title": "Vision One - Endpoint Inventory",
      "screenshot_file": "screenshots/click-004.jpg"
    },
    {
      "index": 5,
      "timestamp": "$(ts_offset 285)",
      "type": "click",
      "dom_path": "div.endpoint-detail > button.isolate-endpoint",
      "element": {
        "tag": "button",
        "id": "btn-isolate",
        "class": "isolate-endpoint ant-btn-danger",
        "text": "Isolate Endpoint",
        "href": null
      },
      "coordinates": {"x": 920, "y": 155},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security/endpoint-detail",
      "page_title": "Vision One - Endpoint Detail",
      "screenshot_file": "screenshots/click-005.jpg"
    },
    {
      "index": 6,
      "timestamp": "$(ts_offset 380)",
      "type": "click",
      "dom_path": "div#menuxdr_app > span.ant-menu-title",
      "element": {
        "tag": "span",
        "id": "xdr-nav",
        "class": "ant-menu-title",
        "text": "XDR",
        "href": "/app/xdr"
      },
      "coordinates": {"x": 85, "y": 320},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
      "page_title": "Vision One - XDR Workbench",
      "screenshot_file": "screenshots/click-006.jpg"
    },
    {
      "index": 7,
      "timestamp": "$(ts_offset 450)",
      "type": "click",
      "dom_path": "table.workbench-alerts > tbody > tr:nth-child(1) > td.alert-name",
      "element": {
        "tag": "td",
        "id": "",
        "class": "alert-name",
        "text": "Suspicious PowerShell Execution on DESKTOP-MER-0847",
        "href": null
      },
      "coordinates": {"x": 520, "y": 290},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
      "page_title": "Vision One - XDR Workbench",
      "screenshot_file": "screenshots/click-007.jpg"
    },
    {
      "index": 8,
      "timestamp": "$(ts_offset 540)",
      "type": "click",
      "dom_path": "div.detection-graph > svg > g.node-endpoint",
      "element": {
        "tag": "g",
        "id": "graph-node-ep",
        "class": "node-endpoint",
        "text": "DESKTOP-MER-0847",
        "href": null
      },
      "coordinates": {"x": 750, "y": 440},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/detection-detail",
      "page_title": "Vision One - Detection Detail",
      "screenshot_file": "screenshots/click-008.jpg"
    },
    {
      "index": 9,
      "timestamp": "$(ts_offset 660)",
      "type": "click",
      "dom_path": "div.response-actions > button.create-playbook",
      "element": {
        "tag": "button",
        "id": "btn-playbook",
        "class": "create-playbook ant-btn-primary",
        "text": "Create Response Playbook",
        "href": null
      },
      "coordinates": {"x": 880, "y": 620},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/detection-detail",
      "page_title": "Vision One - Detection Detail",
      "screenshot_file": "screenshots/click-009.jpg"
    },
    {
      "index": 10,
      "timestamp": "$(ts_offset 780)",
      "type": "click",
      "dom_path": "div#menusetting > span.ant-menu-title",
      "element": {
        "tag": "span",
        "id": "admin-nav",
        "class": "ant-menu-title",
        "text": "Administration",
        "href": "/app/settings"
      },
      "coordinates": {"x": 85, "y": 720},
      "page_url": "https://portal.xdr.trendmicro.com/app/settings/policy",
      "page_title": "Vision One - Policy Management",
      "screenshot_file": "screenshots/click-010.jpg"
    }
  ]
}
ENDJSON

echo "[2/6] Uploading clicks/clicks.json (10 events) ..."
${AWS} s3 cp "${TMP}/clicks.json" "${S3_PREFIX}/clicks/clicks.json" --quiet

# ── 3. transcript/transcript.json ────────────────────────────────────────────
cat > "${TMP}/transcript.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "source": "recording.wav",
  "duration_seconds": 900,
  "entries": [
    {
      "timestamp": "00:00:03.000",
      "speaker": "SE",
      "text": "Welcome, Sarah! Thanks for stopping by. I'm Casey — let me give you a quick tour of Trend Vision One."
    },
    {
      "timestamp": "00:00:12.000",
      "speaker": "Visitor",
      "text": "Great, we've been looking at consolidating our security stack. We currently have about 8,000 endpoints across three regions."
    },
    {
      "timestamp": "00:00:25.000",
      "speaker": "SE",
      "text": "Perfect use case. So this is the main dashboard — you can see the overall risk index here. It pulls telemetry from endpoints, email, network, and cloud workloads into one score."
    },
    {
      "timestamp": "00:00:45.000",
      "speaker": "Visitor",
      "text": "How is that risk score calculated? We've had issues with other vendors where the score doesn't reflect reality."
    },
    {
      "timestamp": "00:01:05.000",
      "speaker": "SE",
      "text": "Good question. It's a composite index based on vulnerability exposure, misconfiguration, and active threat detections. You can drill into each factor. Let me show you the endpoint security operations."
    },
    {
      "timestamp": "00:02:00.000",
      "speaker": "SE",
      "text": "Here's the endpoint inventory. I can see every managed device, its agent version, policy status, and last communication. Let me click into this workstation."
    },
    {
      "timestamp": "00:02:30.000",
      "speaker": "Visitor",
      "text": "Can you show me endpoint isolation? That's been a pain point — our current tool takes 15 minutes to isolate a compromised machine."
    },
    {
      "timestamp": "00:03:00.000",
      "speaker": "SE",
      "text": "Absolutely. One click here — isolate endpoint. It happens in under 30 seconds. The endpoint loses network except for the management channel back to Vision One."
    },
    {
      "timestamp": "00:03:30.000",
      "speaker": "Visitor",
      "text": "That's much faster. What about the investigation side? If we isolate, we still need to understand what happened."
    },
    {
      "timestamp": "00:04:00.000",
      "speaker": "SE",
      "text": "That's where XDR comes in. Let me switch to the workbench. See this alert — Suspicious PowerShell Execution on the same machine we just looked at. Vision One automatically correlated it."
    },
    {
      "timestamp": "00:05:30.000",
      "speaker": "Visitor",
      "text": "So it connects the endpoint detection to the investigation automatically? We do that manually today with three different consoles."
    },
    {
      "timestamp": "00:06:00.000",
      "speaker": "SE",
      "text": "Exactly — single pane of glass. And this detection graph shows the full attack chain: the initial phishing email, the PowerShell download, lateral movement attempts. All auto-correlated."
    },
    {
      "timestamp": "00:07:30.000",
      "speaker": "Visitor",
      "text": "This is really compelling. What about custom detection rules? We have some industry-specific compliance requirements in financial services."
    },
    {
      "timestamp": "00:08:00.000",
      "speaker": "SE",
      "text": "Great question. You can create custom detection rules right from the workbench. YARA rules, STIX patterns, or our own query language. Let me show you the response playbook builder too."
    },
    {
      "timestamp": "00:09:00.000",
      "speaker": "SE",
      "text": "Here you can chain response actions: isolate, collect forensic package, notify SOC team, create ServiceNow ticket — all automated based on detection criteria."
    },
    {
      "timestamp": "00:10:00.000",
      "speaker": "Visitor",
      "text": "We use ServiceNow. Does the integration work both ways?"
    },
    {
      "timestamp": "00:10:30.000",
      "speaker": "SE",
      "text": "Yes — bidirectional. Alerts create tickets automatically, and ticket resolution can trigger policy updates. Let me show you the policy management under Administration."
    },
    {
      "timestamp": "00:11:30.000",
      "speaker": "Visitor",
      "text": "How does licensing work for 8,000 endpoints? We need endpoint, XDR, and the email gateway."
    },
    {
      "timestamp": "00:12:00.000",
      "speaker": "SE",
      "text": "Vision One is credit-based. You get a pool of credits and allocate them across whatever capabilities you need. Endpoint, email, network, cloud — it's all one platform, one license."
    },
    {
      "timestamp": "00:13:00.000",
      "speaker": "Visitor",
      "text": "That simplifies procurement significantly. Can I get a trial environment to test with our team?"
    },
    {
      "timestamp": "00:13:30.000",
      "speaker": "SE",
      "text": "Absolutely. We'll set up a dedicated Vision One tenant for you — you'll get full access for 30 days. I'll send you the details along with a summary of everything we covered today."
    },
    {
      "timestamp": "00:14:30.000",
      "speaker": "Visitor",
      "text": "Perfect. Let me grab a card for you as well. This has been really helpful — especially the XDR correlation piece."
    },
    {
      "timestamp": "00:15:00.000",
      "speaker": "SE",
      "text": "Thanks, Sarah! Keep an eye out for that email with your tenant link and session summary. Great meeting you."
    }
  ]
}
ENDJSON

echo "[3/6] Uploading transcript/transcript.json (23 entries, 15-min demo) ..."
${AWS} s3 cp "${TMP}/transcript.json" "${S3_PREFIX}/transcript/transcript.json" --quiet

# ── 4. commands/end.json ──────────────────────────────────────────────────────
cat > "${TMP}/end.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "status": "ended",
  "ended_at": "${END_TS}"
}
ENDJSON

echo "[4/6] Uploading commands/end.json ..."
${AWS} s3 cp "${TMP}/end.json" "${S3_PREFIX}/commands/end.json" --quiet

# ── 5. Update metadata: status=completed (triggers watcher) ──────────────────
cat > "${TMP}/metadata-final.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "Sarah Chen",
  "company": "Meridian Financial Services",
  "badge_photo": "badge.jpg",
  "started_at": "${START_TS}",
  "ended_at": "${END_TS}",
  "demo_pc": "booth-pc-3",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed",
  "upload_complete": true
}
ENDJSON

echo "[5/6] Updating metadata.json (status=completed -- triggers analysis) ..."
${AWS} s3 cp "${TMP}/metadata-final.json" "${S3_PREFIX}/metadata.json" --quiet

echo "[6/6] Session data uploaded."
echo ""
echo "================================================================"
echo "  Session ID:  ${SESSION_ID}"
echo "  S3 path:     ${S3_PREFIX}/"
echo "  Status:      completed (watcher should pick this up)"
echo "================================================================"

# ── Verify upload ─────────────────────────────────────────────────────────────
echo ""
echo "Uploaded files:"
${AWS} s3 ls "${S3_PREFIX}/" --recursive | sed 's/^/  /'

# ── 6. Poll for output/summary.html ──────────────────────────────────────────
if [ "$WAIT" = false ]; then
  echo ""
  echo "Skipping wait (--no-wait). Check manually:"
  echo "  ${AWS} s3 ls ${S3_PREFIX}/output/"
  exit 0
fi

echo ""
echo "Waiting for analysis pipeline to produce output/summary.html ..."
echo "(The watcher polls every 30s, analysis takes 1-3 min)"
echo ""

TIMEOUT=600  # 10 minutes
POLL=15      # check every 15s
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Check for summary.html
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.html" >/dev/null 2>&1; then
    echo ""
    echo "================================================================"
    echo "  summary.html is ready!"
    echo "================================================================"
    echo ""
    echo "Output files:"
    ${AWS} s3 ls "${S3_PREFIX}/output/" | sed 's/^/  /'
    echo ""
    echo "Download summary:"
    echo "  ${AWS} s3 cp ${S3_PREFIX}/output/summary.html ./summary-${SESSION_ID}.html"
    echo ""
    echo "View all session data:"
    echo "  ${AWS} s3 ls ${S3_PREFIX}/ --recursive"
    exit 0
  fi

  # Show progress dots
  MINS=$(( ELAPSED / 60 ))
  SECS=$(( ELAPSED % 60 ))
  printf "\r  [%02d:%02d] Waiting ... " "$MINS" "$SECS"

  # Check for partial output (summary.json arrives before html)
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.json" >/dev/null 2>&1; then
    printf "(summary.json found, html rendering in progress)"
  elif ${AWS} s3 ls "${S3_PREFIX}/output/timeline.json" >/dev/null 2>&1; then
    printf "(timeline.json found, Claude analysis in progress)"
  elif ${AWS} s3 ls "${S3_PREFIX}/output/.analysis-claimed" >/dev/null 2>&1; then
    printf "(analysis claimed by watcher, pipeline running)"
  fi

  sleep $POLL
  ELAPSED=$(( ELAPSED + POLL ))
done

echo ""
echo "================================================================"
echo "  TIMEOUT after ${TIMEOUT}s — summary.html not found"
echo "================================================================"
echo ""
echo "Troubleshooting:"
echo "  1. Is the watcher running?"
echo "     S3_BUCKET=${BUCKET} AWS_REGION=${REGION} node analysis/watcher.js"
echo ""
echo "  2. Check what output exists:"
echo "     ${AWS} s3 ls ${S3_PREFIX}/output/"
echo ""
echo "  3. Check if session was claimed:"
echo "     ${AWS} s3 ls ${S3_PREFIX}/output/.analysis-claimed"
echo ""
echo "  4. Run pipeline manually:"
echo "     node analysis/pipeline-run.js ${SESSION_ID} ${BUCKET}"
exit 1
