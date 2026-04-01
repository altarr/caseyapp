#!/usr/bin/env bash
# run-demo-simulation.sh — Full pipeline end-to-end simulation without hardware.
#
# Exercises every stage of the BoothApp pipeline using realistic fake data:
#   1. Create session via Lambda function URL (or aws lambda invoke fallback)
#   2. Upload click data (7 V1 console clicks) and mock audio to S3
#   3. Upload transcript.json (3-minute demo conversation)
#   4. Trigger analysis by setting status=completed + writing end.json
#   5. Poll S3 for output/summary.json
#   6. Download and display the final report
#
# Visitor: Sarah Mitchell from Acme Corp
# Demo:    3 minutes, 7 clicks (XDR, Endpoint Security, Email Security)
#
# Usage:
#   ./scripts/run-demo-simulation.sh                  # auto-generate session ID
#   ./scripts/run-demo-simulation.sh --id SIM-12345   # custom session ID
#   ./scripts/run-demo-simulation.sh --no-wait        # upload only, skip polling
#   ./scripts/run-demo-simulation.sh --lambda-invoke   # use aws lambda invoke instead of curl
#
# Requires: aws CLI configured with 'hackathon' profile, jq
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
LAMBDA_FUNCTION="boothapp-session-orchestrator"
DEMO_PC="booth-pc-3"

AWS="aws --profile ${PROFILE} --region ${REGION}"

# ── Args ──────────────────────────────────────────────────────────────────────
SESSION_ID=""
WAIT=true
USE_LAMBDA_INVOKE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)             SESSION_ID="$2"; shift 2 ;;
    --no-wait)        WAIT=false; shift ;;
    --lambda-invoke)  USE_LAMBDA_INVOKE=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--id SESSION_ID] [--no-wait] [--lambda-invoke]"
      echo ""
      echo "Options:"
      echo "  --id ID           Use a specific session ID (default: SIM-<epoch>)"
      echo "  --no-wait         Upload data only, don't poll for analysis output"
      echo "  --lambda-invoke   Use 'aws lambda invoke' instead of curl to function URL"
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Generate session ID if not provided (uppercase alphanumeric per orchestrator validation)
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="SIM$(date +%s)"
fi

PREFIX="sessions/${SESSION_ID}"
S3_PREFIX="s3://${BUCKET}/${PREFIX}"
CMD_PREFIX="s3://${BUCKET}/commands/${DEMO_PC}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── Timestamps (3-minute demo) ────────────────────────────────────────────────
START_EPOCH=$(date +%s)
START_TS=$(date -u -d @"${START_EPOCH}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
        || date -u -r "${START_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)

ts_offset() {
  local offset=$1
  date -u -d @$(( START_EPOCH + offset )) +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null \
    || date -u -r $(( START_EPOCH + offset )) +%Y-%m-%dT%H:%M:%S.000Z
}

END_EPOCH=$(( START_EPOCH + 180 ))  # 3 minutes
END_TS=$(date -u -d @"${END_EPOCH}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
      || date -u -r "${END_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)

echo "================================================================"
echo "  BoothApp Full Pipeline Simulation"
echo "  Session:  ${SESSION_ID}"
echo "  Visitor:  Sarah Mitchell (Acme Corp)"
echo "  Duration: 3 minutes, 7 clicks"
echo "  Bucket:   s3://${BUCKET}"
echo "================================================================"
echo ""

# ── Step 1: Create session via Lambda ─────────────────────────────────────────
echo "[1/7] Creating session via Lambda ..."

CREATE_PAYLOAD=$(cat <<ENDJSON
{
  "visitor_name": "Sarah Mitchell",
  "company": "Acme Corp",
  "demo_pc": "${DEMO_PC}",
  "se_name": "Casey Mondoux",
  "audio_consent": true
}
ENDJSON
)

if [ "$USE_LAMBDA_INVOKE" = true ]; then
  # Use aws lambda invoke (works without function URL)
  echo "$CREATE_PAYLOAD" > "${TMP}/create-payload.json"
  INVOKE_PAYLOAD=$(cat <<ENDJSON
{
  "requestContext": {"http": {"method": "POST", "path": "/sessions"}},
  "body": $(echo "$CREATE_PAYLOAD" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"),
  "isBase64Encoded": false
}
ENDJSON
)
  echo "$INVOKE_PAYLOAD" > "${TMP}/invoke-payload.json"
  ${AWS} lambda invoke \
    --function-name "${LAMBDA_FUNCTION}" \
    --payload "file://${TMP}/invoke-payload.json" \
    --cli-binary-format raw-in-base64-out \
    "${TMP}/lambda-response.json" \
    --quiet 2>/dev/null || true

  if [ -f "${TMP}/lambda-response.json" ]; then
    LAMBDA_BODY=$(cat "${TMP}/lambda-response.json")
    # Extract session_id from Lambda response if available
    LAMBDA_SID=$(echo "$LAMBDA_BODY" | python3 -c "
import sys, json
try:
    resp = json.loads(sys.stdin.read())
    body = json.loads(resp.get('body', '{}')) if isinstance(resp.get('body'), str) else resp
    print(body.get('session_id', ''))
except: print('')
" 2>/dev/null || echo "")
    if [ -n "$LAMBDA_SID" ]; then
      echo "  Lambda created session: ${LAMBDA_SID}"
      # Use Lambda-assigned ID if we didn't specify one
      if [[ "$SESSION_ID" == SIM* ]]; then
        SESSION_ID="$LAMBDA_SID"
        PREFIX="sessions/${SESSION_ID}"
        S3_PREFIX="s3://${BUCKET}/${PREFIX}"
      fi
    else
      echo "  Lambda invoke returned (may not have session_id): using ${SESSION_ID}"
    fi
  fi
else
  # Use curl to function URL
  FUNCTION_URL=$(${AWS} lambda get-function-url-config \
    --function-name "${LAMBDA_FUNCTION}" \
    --query 'FunctionUrl' --output text 2>/dev/null || echo "")

  if [ -n "$FUNCTION_URL" ] && [ "$FUNCTION_URL" != "None" ]; then
    echo "  Function URL: ${FUNCTION_URL}"
    CURL_RESP=$(curl -s -X POST "${FUNCTION_URL}sessions" \
      -H "Content-Type: application/json" \
      -d "$CREATE_PAYLOAD" 2>/dev/null || echo "{}")
    LAMBDA_SID=$(echo "$CURL_RESP" | python3 -c "
import sys, json
try:
    resp = json.loads(sys.stdin.read())
    print(resp.get('session_id', ''))
except: print('')
" 2>/dev/null || echo "")
    if [ -n "$LAMBDA_SID" ]; then
      echo "  Lambda created session: ${LAMBDA_SID}"
      SESSION_ID="$LAMBDA_SID"
      PREFIX="sessions/${SESSION_ID}"
      S3_PREFIX="s3://${BUCKET}/${PREFIX}"
    else
      echo "  Lambda response: ${CURL_RESP}"
      echo "  Falling back to direct S3 upload with ID: ${SESSION_ID}"
    fi
  else
    echo "  No function URL found -- falling back to direct S3 upload"
  fi
fi

# Write metadata directly to S3 (ensures it exists even if Lambda failed)
cat > "${TMP}/metadata.json" <<ENDJSON
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
ENDJSON
${AWS} s3 cp "${TMP}/metadata.json" "${S3_PREFIX}/metadata.json" --quiet
echo "  metadata.json uploaded (status=active)"

# ── Step 2: Upload sample audio placeholder ───────────────────────────────────
echo ""
echo "[2/7] Uploading sample audio recording ..."

# Generate a minimal WAV header (44 bytes) + 1 second of silence at 44100Hz stereo
# This is enough for the pipeline to recognize a valid audio file
python3 -c "
import struct, sys
sample_rate = 44100
channels = 2
bits = 16
duration = 1  # 1 second placeholder
num_samples = sample_rate * duration * channels
data_size = num_samples * (bits // 8)
header = struct.pack('<4sI4s4sIHHIIHH4sI',
    b'RIFF', 36 + data_size, b'WAVE',
    b'fmt ', 16, 1, channels, sample_rate,
    sample_rate * channels * bits // 8, channels * bits // 8, bits,
    b'data', data_size)
sys.stdout.buffer.write(header + b'\x00' * data_size)
" > "${TMP}/recording.wav"
${AWS} s3 cp "${TMP}/recording.wav" "${S3_PREFIX}/audio/recording.wav" --quiet
echo "  audio/recording.wav uploaded (placeholder WAV, $(wc -c < "${TMP}/recording.wav") bytes)"

# ── Step 3: Upload clicks.json (7 V1 console clicks) ─────────────────────────
echo ""
echo "[3/7] Uploading clicks/clicks.json (7 V1 console clicks) ..."

cat > "${TMP}/clicks.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "events": [
    {
      "index": 1,
      "timestamp": "$(ts_offset 8)",
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
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    },
    {
      "index": 2,
      "timestamp": "$(ts_offset 30)",
      "type": "click",
      "dom_path": "table.workbench-alerts > tbody > tr:nth-child(1) > td.alert-name",
      "element": {
        "tag": "td",
        "id": "",
        "class": "alert-name critical-severity",
        "text": "Ransomware Activity Detected on ACME-WS-0142",
        "href": null
      },
      "coordinates": {"x": 520, "y": 290},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
      "page_title": "Vision One - XDR Workbench",
      "screenshot_file": "screenshots/click-002.jpg"
    },
    {
      "index": 3,
      "timestamp": "$(ts_offset 55)",
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
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench/alert-01192",
      "page_title": "Vision One - Alert Detail",
      "screenshot_file": "screenshots/click-003.jpg"
    },
    {
      "index": 4,
      "timestamp": "$(ts_offset 80)",
      "type": "click",
      "dom_path": "div.ep-content > section > div.policy-list > a.policy-endpoint",
      "element": {
        "tag": "a",
        "id": "policy-ep",
        "class": "policy-item policy-endpoint",
        "text": "Endpoint Protection Policy",
        "href": "/app/endpoint-security/policies/endpoint"
      },
      "coordinates": {"x": 610, "y": 340},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security",
      "page_title": "Vision One - Endpoint Security",
      "screenshot_file": "screenshots/click-004.jpg"
    },
    {
      "index": 5,
      "timestamp": "$(ts_offset 110)",
      "type": "click",
      "dom_path": "div#menuemail_security_operations > span.ant-menu-title",
      "element": {
        "tag": "span",
        "id": "email-nav",
        "class": "ant-menu-title",
        "text": "Email Security",
        "href": "/app/email-security"
      },
      "coordinates": {"x": 85, "y": 520},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security/policies/endpoint",
      "page_title": "Vision One - Endpoint Protection Policy",
      "screenshot_file": "screenshots/click-005.jpg"
    },
    {
      "index": 6,
      "timestamp": "$(ts_offset 135)",
      "type": "click",
      "dom_path": "div.email-content > section.quarantine > table > tr:nth-child(2)",
      "element": {
        "tag": "tr",
        "id": "",
        "class": "quarantine-row",
        "text": "Phishing: Invoice Payment Required - accounts@suspicious-domain.com",
        "href": null
      },
      "coordinates": {"x": 650, "y": 410},
      "page_url": "https://portal.xdr.trendmicro.com/app/email-security/quarantine",
      "page_title": "Vision One - Email Quarantine",
      "screenshot_file": "screenshots/click-006.jpg"
    },
    {
      "index": 7,
      "timestamp": "$(ts_offset 160)",
      "type": "click",
      "dom_path": "div.email-detail > div.threat-analysis > button.trace-email",
      "element": {
        "tag": "button",
        "id": "btn-trace",
        "class": "trace-email ant-btn-primary",
        "text": "Trace Email Origin",
        "href": null
      },
      "coordinates": {"x": 880, "y": 520},
      "page_url": "https://portal.xdr.trendmicro.com/app/email-security/quarantine/detail",
      "page_title": "Vision One - Email Detail",
      "screenshot_file": "screenshots/click-007.jpg"
    }
  ]
}
ENDJSON
${AWS} s3 cp "${TMP}/clicks.json" "${S3_PREFIX}/clicks/clicks.json" --quiet
echo "  clicks/clicks.json uploaded (7 events: XDR, Endpoint Security, Email Security)"

# ── Step 4: Upload transcript.json (3-minute conversation) ────────────────────
echo ""
echo "[4/7] Uploading transcript/transcript.json (3-minute demo) ..."

cat > "${TMP}/transcript.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "source": "recording.wav",
  "duration_seconds": 180,
  "entries": [
    {
      "timestamp": "00:00:03.000",
      "speaker": "SE",
      "text": "Hi Sarah, welcome to the TrendAI booth! I'm Casey. I see you're from Acme Corp -- what's your role there?"
    },
    {
      "timestamp": "00:00:10.000",
      "speaker": "Visitor",
      "text": "I'm the Director of Security Operations. We have about 5,000 endpoints and we're dealing with a lot of phishing and ransomware attempts lately."
    },
    {
      "timestamp": "00:00:20.000",
      "speaker": "SE",
      "text": "That's a perfect use case for Vision One. Let me start with XDR -- this is our extended detection and response module where all your telemetry converges."
    },
    {
      "timestamp": "00:00:30.000",
      "speaker": "SE",
      "text": "Here's the Workbench. All alerts from endpoint, email, and network sensors flow into this single view. See this ransomware alert? Let me drill into it."
    },
    {
      "timestamp": "00:00:45.000",
      "speaker": "Visitor",
      "text": "We're using three separate consoles right now for endpoint, email, and SIEM. The correlation between them is completely manual."
    },
    {
      "timestamp": "00:00:55.000",
      "speaker": "SE",
      "text": "That's exactly what Vision One eliminates. One platform, automatic correlation. Now let me show you Endpoint Security -- this is where you manage protection policies."
    },
    {
      "timestamp": "00:01:10.000",
      "speaker": "SE",
      "text": "You can define granular policies per group. Anti-malware, behavior monitoring, web reputation, device control -- all in one policy object."
    },
    {
      "timestamp": "00:01:25.000",
      "speaker": "Visitor",
      "text": "Can we push different policies to different departments? Our finance team needs stricter USB controls than engineering."
    },
    {
      "timestamp": "00:01:35.000",
      "speaker": "SE",
      "text": "Absolutely -- policy inheritance with per-group overrides. Now let me show you the email security side, since you mentioned phishing is a big concern."
    },
    {
      "timestamp": "00:01:50.000",
      "speaker": "SE",
      "text": "This is the email quarantine view. You can see this phishing email was caught before delivery. I can trace its origin, see who else received similar messages, and create a sweep rule."
    },
    {
      "timestamp": "00:02:10.000",
      "speaker": "Visitor",
      "text": "That trace feature is exactly what we need. Last month we had a phishing campaign hit 200 users and it took us two days to find all the affected mailboxes."
    },
    {
      "timestamp": "00:02:25.000",
      "speaker": "SE",
      "text": "With Vision One, that's a one-click operation. The email trace shows every recipient, delivery status, and you can quarantine them all in bulk. Plus XDR correlates any endpoint activity from users who clicked."
    },
    {
      "timestamp": "00:02:45.000",
      "speaker": "Visitor",
      "text": "This is really compelling. Can we get a trial tenant to test with our team? We'd want to connect our Exchange Online and some test endpoints."
    },
    {
      "timestamp": "00:02:55.000",
      "speaker": "SE",
      "text": "We'll set you up with a dedicated tenant -- 30 days, full access. I'll send you a personalized summary of everything we covered plus the tenant link. Great meeting you, Sarah!"
    }
  ]
}
ENDJSON
${AWS} s3 cp "${TMP}/transcript.json" "${S3_PREFIX}/transcript/transcript.json" --quiet
echo "  transcript/transcript.json uploaded (14 entries, 3:00 duration)"

# ── Step 5: Trigger analysis -- end.json + metadata status=completed ──────────
echo ""
echo "[5/7] Triggering analysis pipeline ..."

# Write end.json to commands path
cat > "${TMP}/end.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "demo_pc": "${DEMO_PC}",
  "ended_at": "${END_TS}"
}
ENDJSON
${AWS} s3 cp "${TMP}/end.json" "${CMD_PREFIX}/end.json" --quiet
echo "  commands/${DEMO_PC}/end.json uploaded"

# Also write end.json inside session folder (watcher checks both)
${AWS} s3 cp "${TMP}/end.json" "${S3_PREFIX}/commands/end.json" --quiet
echo "  sessions/${SESSION_ID}/commands/end.json uploaded"

# Update metadata to status=completed (this is what the watcher keys on)
cat > "${TMP}/metadata-final.json" <<ENDJSON
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
ENDJSON
${AWS} s3 cp "${TMP}/metadata-final.json" "${S3_PREFIX}/metadata.json" --quiet
echo "  metadata.json updated (status=completed -- triggers watcher)"

# ── Step 6: Verify uploads ────────────────────────────────────────────────────
echo ""
echo "[6/7] Verifying uploads ..."
echo ""
echo "Session files:"
${AWS} s3 ls "s3://${BUCKET}/${PREFIX}/" --recursive | sed 's/^/  /'

# ── Step 7: Poll for output/summary.json ──────────────────────────────────────
echo ""
if [ "$WAIT" = false ]; then
  echo "[7/7] Skipping wait (--no-wait)."
  echo ""
  echo "Check manually:"
  echo "  ${AWS} s3 ls ${S3_PREFIX}/output/"
  echo ""
  echo "Run pipeline manually:"
  echo "  S3_BUCKET=${BUCKET} AWS_REGION=${REGION} node analysis/pipeline-run.js ${SESSION_ID} ${BUCKET}"
  exit 0
fi

echo "[7/7] Waiting for output/summary.json ..."
echo "  (Watcher polls every 30s, analysis takes 1-3 min)"
echo ""

TIMEOUT=600  # 10 minutes
POLL=10      # check every 10s
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Check for summary.json (primary target)
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.json" >/dev/null 2>&1; then
    echo ""
    echo "================================================================"
    echo "  output/summary.json is READY!"
    echo "================================================================"
    echo ""

    # Download and display the report
    ${AWS} s3 cp "${S3_PREFIX}/output/summary.json" "${TMP}/summary.json" --quiet
    echo "--- SUMMARY REPORT ---"
    if command -v jq &>/dev/null; then
      jq '.' "${TMP}/summary.json"
    else
      python3 -m json.tool "${TMP}/summary.json"
    fi
    echo "--- END REPORT ---"

    # Check for other output files
    echo ""
    echo "All output files:"
    ${AWS} s3 ls "${S3_PREFIX}/output/" | sed 's/^/  /'

    # Download summary.html if it exists
    if ${AWS} s3 ls "${S3_PREFIX}/output/summary.html" >/dev/null 2>&1; then
      ${AWS} s3 cp "${S3_PREFIX}/output/summary.html" "${TMP}/summary.html" --quiet
      echo ""
      echo "HTML report downloaded to: ${TMP}/summary.html"
    fi

    echo ""
    echo "================================================================"
    echo "  Simulation complete!"
    echo "  Session:  ${SESSION_ID}"
    echo "  Visitor:  Sarah Mitchell (Acme Corp)"
    echo "  S3 path:  ${S3_PREFIX}/"
    echo "================================================================"
    exit 0
  fi

  # Show progress with stage detection
  MINS=$(( ELAPSED / 60 ))
  SECS=$(( ELAPSED % 60 ))
  STAGE=""
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.html" >/dev/null 2>&1; then
    STAGE=" [html found, json rendering]"
  elif ${AWS} s3 ls "${S3_PREFIX}/output/timeline.json" >/dev/null 2>&1; then
    STAGE=" [timeline done, Claude analyzing]"
  elif ${AWS} s3 ls "${S3_PREFIX}/output/.analysis-claimed" >/dev/null 2>&1; then
    STAGE=" [claimed, pipeline running]"
  fi
  printf "\r  [%02d:%02d] Waiting ...%s" "$MINS" "$SECS" "$STAGE"

  sleep $POLL
  ELAPSED=$(( ELAPSED + POLL ))
done

echo ""
echo "================================================================"
echo "  TIMEOUT after ${TIMEOUT}s -- summary.json not found"
echo "================================================================"
echo ""
echo "Troubleshooting:"
echo "  1. Is the watcher running?"
echo "     S3_BUCKET=${BUCKET} AWS_REGION=${REGION} node analysis/watcher.js"
echo ""
echo "  2. Check output so far:"
echo "     ${AWS} s3 ls ${S3_PREFIX}/output/"
echo ""
echo "  3. Run pipeline manually:"
echo "     node analysis/pipeline-run.js ${SESSION_ID} ${BUCKET}"
echo ""
echo "  4. Check watcher health:"
echo "     curl -s http://localhost:8090/health | jq ."
exit 1
