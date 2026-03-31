#!/usr/bin/env bash
# run-demo.sh — Self-contained demo of the full BoothApp pipeline.
#
# Walks through every stage with clear output:
#   1. Create session via Lambda invoke
#   2. Upload sample click data to S3
#   3. Upload sample audio transcript to S3
#   4. Mark session as ended (triggers watcher)
#   5. Wait for watcher to produce analysis output
#   6. Print the output summary URL
#
# All sample data is inline -- no external files needed.
#
# Requires: aws CLI (profile: hackathon), jq or python3
# Usage:    ./scripts/run-demo.sh
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
LAMBDA_FUNCTION="boothapp-session-orchestrator"
DEMO_PC="booth-pc-3"
AWS="aws --profile ${PROFILE} --region ${REGION}"

SESSION_ID="DEMO$(date +%s)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

NOW_EPOCH=$(date +%s)
START_TS=$(date -u -d @"${NOW_EPOCH}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
        || date -u -r "${NOW_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)
END_EPOCH=$(( NOW_EPOCH + 180 ))
END_TS=$(date -u -d @"${END_EPOCH}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
      || date -u -r "${END_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)

PREFIX="sessions/${SESSION_ID}"
S3="s3://${BUCKET}/${PREFIX}"

echo "============================================================"
echo "  BoothApp Demo"
echo "  Session: ${SESSION_ID}"
echo "  Bucket:  s3://${BUCKET}"
echo "============================================================"
echo ""

# ── Step 1: Create session via Lambda ─────────────────────────────────────────
echo "[Step 1/6] Creating session via Lambda invoke ..."

cat > "${TMP}/invoke-payload.json" <<EOF
{
  "requestContext": {"http": {"method": "POST", "path": "/sessions"}},
  "body": "{\"visitor_name\":\"Sarah Mitchell\",\"company\":\"Acme Corp\",\"demo_pc\":\"${DEMO_PC}\",\"se_name\":\"Casey Mondoux\",\"audio_consent\":true}",
  "isBase64Encoded": false
}
EOF

${AWS} lambda invoke \
  --function-name "${LAMBDA_FUNCTION}" \
  --payload "file://${TMP}/invoke-payload.json" \
  --cli-binary-format raw-in-base64-out \
  "${TMP}/lambda-response.json" \
  --quiet 2>/dev/null || true

# Try to use the Lambda-assigned session ID
if [ -f "${TMP}/lambda-response.json" ]; then
  LAMBDA_SID=$(python3 -c "
import json, sys
try:
    resp = json.load(open('${TMP}/lambda-response.json'))
    body = json.loads(resp.get('body', '{}')) if isinstance(resp.get('body'), str) else resp
    print(body.get('session_id', ''))
except: print('')
" 2>/dev/null || echo "")
  if [ -n "$LAMBDA_SID" ]; then
    SESSION_ID="$LAMBDA_SID"
    PREFIX="sessions/${SESSION_ID}"
    S3="s3://${BUCKET}/${PREFIX}"
    echo "  -> Lambda assigned session: ${SESSION_ID}"
  else
    echo "  -> Lambda did not return session_id, using: ${SESSION_ID}"
  fi
else
  echo "  -> Lambda invoke failed, using direct S3 upload with: ${SESSION_ID}"
fi

# Ensure metadata exists in S3 (covers Lambda failure case)
cat > "${TMP}/metadata.json" <<EOF
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "Sarah Mitchell",
  "company": "Acme Corp",
  "badge_photo": null,
  "started_at": "${START_TS}",
  "ended_at": null,
  "demo_pc": "${DEMO_PC}",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "active",
  "upload_complete": false
}
EOF
${AWS} s3 cp "${TMP}/metadata.json" "${S3}/metadata.json" --quiet
echo "  -> metadata.json uploaded (status=active)"
echo ""

# ── Step 2: Upload sample click data ─────────────────────────────────────────
echo "[Step 2/6] Uploading click data (5 V1 console clicks) ..."

cat > "${TMP}/clicks.json" <<EOF
{
  "session_id": "${SESSION_ID}",
  "events": [
    {
      "index": 1, "timestamp": "${START_TS}", "type": "click",
      "dom_path": "div#menuxdr_app > span",
      "element": {"tag": "span", "id": "xdr-nav", "class": "ant-menu-title", "text": "XDR", "href": "/app/xdr"},
      "coordinates": {"x": 85, "y": 320},
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    },
    {
      "index": 2, "timestamp": "${START_TS}", "type": "click",
      "dom_path": "table.workbench-alerts > tbody > tr:nth-child(1)",
      "element": {"tag": "td", "id": "", "class": "alert-name", "text": "Ransomware Activity Detected on WS-0142", "href": null},
      "coordinates": {"x": 520, "y": 290},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
      "page_title": "Vision One - XDR Workbench",
      "screenshot_file": "screenshots/click-002.jpg"
    },
    {
      "index": 3, "timestamp": "${START_TS}", "type": "click",
      "dom_path": "div#menuendpoint_security_operations > span",
      "element": {"tag": "span", "id": "ep-nav", "class": "ant-menu-title", "text": "Endpoint Security", "href": "/app/endpoint-security"},
      "coordinates": {"x": 85, "y": 420},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench/alert-01192",
      "page_title": "Vision One - Alert Detail",
      "screenshot_file": "screenshots/click-003.jpg"
    },
    {
      "index": 4, "timestamp": "${START_TS}", "type": "click",
      "dom_path": "div.policy-list > a.policy-endpoint",
      "element": {"tag": "a", "id": "policy-ep", "class": "policy-endpoint", "text": "Endpoint Protection Policy", "href": "/app/endpoint-security/policies/endpoint"},
      "coordinates": {"x": 610, "y": 340},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security",
      "page_title": "Vision One - Endpoint Security",
      "screenshot_file": "screenshots/click-004.jpg"
    },
    {
      "index": 5, "timestamp": "${START_TS}", "type": "click",
      "dom_path": "div#menuemail_security_operations > span",
      "element": {"tag": "span", "id": "email-nav", "class": "ant-menu-title", "text": "Email Security", "href": "/app/email-security"},
      "coordinates": {"x": 85, "y": 520},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security/policies/endpoint",
      "page_title": "Vision One - Endpoint Protection Policy",
      "screenshot_file": "screenshots/click-005.jpg"
    }
  ]
}
EOF
${AWS} s3 cp "${TMP}/clicks.json" "${S3}/clicks/clicks.json" --quiet
echo "  -> clicks/clicks.json uploaded"
echo ""

# ── Step 3: Upload sample audio transcript ────────────────────────────────────
echo "[Step 3/6] Uploading audio transcript (3-minute conversation) ..."

cat > "${TMP}/transcript.json" <<EOF
{
  "session_id": "${SESSION_ID}",
  "source": "recording.wav",
  "duration_seconds": 180,
  "entries": [
    {"timestamp": "00:00:03.000", "speaker": "SE", "text": "Hi Sarah, welcome! I'm Casey. What's your role at Acme Corp?"},
    {"timestamp": "00:00:10.000", "speaker": "Visitor", "text": "Director of Security Ops. We have 5,000 endpoints and lots of phishing and ransomware attempts."},
    {"timestamp": "00:00:20.000", "speaker": "SE", "text": "Perfect use case for Vision One. Let me start with XDR -- all your telemetry converges here."},
    {"timestamp": "00:00:35.000", "speaker": "SE", "text": "This is the Workbench. Alerts from endpoint, email, and network sensors in one view. See this ransomware alert?"},
    {"timestamp": "00:00:50.000", "speaker": "Visitor", "text": "We use three separate consoles today. Correlation between them is completely manual."},
    {"timestamp": "00:01:00.000", "speaker": "SE", "text": "Vision One eliminates that. One platform, automatic correlation. Now, Endpoint Security for protection policies."},
    {"timestamp": "00:01:20.000", "speaker": "Visitor", "text": "Can we push different policies to different departments? Finance needs stricter USB controls."},
    {"timestamp": "00:01:35.000", "speaker": "SE", "text": "Absolutely -- policy inheritance with per-group overrides. Now the email security side."},
    {"timestamp": "00:01:50.000", "speaker": "SE", "text": "Email quarantine view. This phishing email was caught pre-delivery. I can trace its origin."},
    {"timestamp": "00:02:10.000", "speaker": "Visitor", "text": "That trace feature is what we need. Last month a phishing campaign hit 200 users, took two days to find all mailboxes."},
    {"timestamp": "00:02:30.000", "speaker": "SE", "text": "With Vision One, one-click operation. Shows every recipient, delivery status, bulk quarantine. XDR correlates endpoint activity too."},
    {"timestamp": "00:02:50.000", "speaker": "Visitor", "text": "Very compelling. Can we get a trial tenant to test with our SOC team?"}
  ]
}
EOF
${AWS} s3 cp "${TMP}/transcript.json" "${S3}/transcript/transcript.json" --quiet
echo "  -> transcript/transcript.json uploaded (12 entries)"
echo ""

# ── Step 4: Mark session as ended ─────────────────────────────────────────────
echo "[Step 4/6] Marking session as ended ..."

# Write end.json to commands path (watcher listens here)
cat > "${TMP}/end.json" <<EOF
{"session_id": "${SESSION_ID}", "demo_pc": "${DEMO_PC}", "ended_at": "${END_TS}"}
EOF
${AWS} s3 cp "${TMP}/end.json" "s3://${BUCKET}/commands/${DEMO_PC}/end.json" --quiet
${AWS} s3 cp "${TMP}/end.json" "${S3}/commands/end.json" --quiet
echo "  -> end.json uploaded to commands path"

# Update metadata to status=completed
cat > "${TMP}/metadata-final.json" <<EOF
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "Sarah Mitchell",
  "company": "Acme Corp",
  "badge_photo": null,
  "started_at": "${START_TS}",
  "ended_at": "${END_TS}",
  "demo_pc": "${DEMO_PC}",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed",
  "upload_complete": true
}
EOF
${AWS} s3 cp "${TMP}/metadata-final.json" "${S3}/metadata.json" --quiet
echo "  -> metadata.json updated (status=completed)"
echo ""

# ── Step 5: Wait for watcher to process ───────────────────────────────────────
echo "[Step 5/6] Waiting for watcher to produce analysis output ..."
echo "  (watcher polls every 30s, analysis takes 1-3 min)"

TIMEOUT=300
POLL=10
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  if ${AWS} s3 ls "${S3}/output/summary.json" >/dev/null 2>&1; then
    echo ""
    echo "  -> summary.json ready! (${ELAPSED}s)"
    break
  fi
  printf "\r  ... %3ds / %ds" "$ELAPSED" "$TIMEOUT"
  sleep $POLL
  ELAPSED=$(( ELAPSED + POLL ))
done
echo ""

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo ""
  echo "  TIMEOUT after ${TIMEOUT}s -- summary.json not found."
  echo ""
  echo "  Is the watcher running?"
  echo "    S3_BUCKET=${BUCKET} AWS_REGION=${REGION} node analysis/watcher.js"
  echo ""
  echo "  Run pipeline manually:"
  echo "    node analysis/pipeline-run.js ${SESSION_ID} ${BUCKET}"
  echo ""
  echo "  Check output so far:"
  echo "    ${AWS} s3 ls ${S3}/output/"
  exit 1
fi

# ── Step 6: Print the output summary ──────────────────────────────────────────
echo ""
echo "[Step 6/6] Analysis complete! Fetching results ..."
echo ""

${AWS} s3 cp "${S3}/output/summary.json" "${TMP}/summary.json" --quiet

echo "--- SESSION SUMMARY ---"
if command -v jq &>/dev/null; then
  jq '.' "${TMP}/summary.json"
else
  python3 -m json.tool "${TMP}/summary.json"
fi
echo "--- END SUMMARY ---"

# List all output files
echo ""
echo "Output files:"
${AWS} s3 ls "${S3}/output/" | sed 's/^/  /'

# Print S3 console URL for the summary
CONSOLE_URL="https://s3.console.aws.amazon.com/s3/object/${BUCKET}?prefix=${PREFIX}/output/summary.html"
echo ""
echo "============================================================"
echo "  Demo complete!"
echo "  Session:    ${SESSION_ID}"
echo "  S3 path:    ${S3}/"
echo "  Summary:    ${S3}/output/summary.html"
echo "  Console:    ${CONSOLE_URL}"
echo "============================================================"
