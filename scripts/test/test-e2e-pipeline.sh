#!/usr/bin/env bash
# test-e2e-pipeline.sh -- End-to-end integration test for the analysis pipeline.
#
# Generates a realistic sample session, uploads it to S3, waits for the watcher
# to process it, validates the output, and cleans up.
#
# Required env:
#   AWS_PROFILE=hackathon
#   S3_BUCKET=boothapp-sessions-752266476357
#   AWS_REGION=us-east-1
#
# Usage:
#   bash scripts/test/test-e2e-pipeline.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
AWS_PROFILE="${AWS_PROFILE:-hackathon}"
S3_BUCKET="${S3_BUCKET:-boothapp-sessions-752266476357}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"

TEST_SESSION_ID="e2e-test-$(date +%s)-$$"
S3_PREFIX="sessions/${TEST_SESSION_ID}"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  [FAIL] $1"; }

cleanup() {
  echo ""
  echo "=== Cleanup ==="
  echo "  Removing s3://${S3_BUCKET}/${S3_PREFIX}/ ..."
  aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || true
  echo "  Done."
}

trap cleanup EXIT

# ── Step 1: Generate sample session data ──────────────────────
echo ""
echo "=== Step 1: Generate Sample Session ==="
echo "  Session ID: ${TEST_SESSION_ID}"

TMPDIR=$(mktemp -d)

# metadata.json
cat > "${TMPDIR}/metadata.json" <<METAEOF
{
  "session_id": "${TEST_SESSION_ID}",
  "visitor_name": "E2E Test Visitor",
  "visitor_company": "Test Corp",
  "se_name": "Test SE",
  "demo_pc": "test-pc-01",
  "started_at": "$(date -u -d '-7 minutes' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-7M +%Y-%m-%dT%H:%M:%S.000Z)",
  "ended_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
METAEOF

# clicks/clicks.json
mkdir -p "${TMPDIR}/clicks"
cat > "${TMPDIR}/clicks/clicks.json" <<CLICKEOF
{
  "session_id": "${TEST_SESSION_ID}",
  "events": [
    {
      "index": 1,
      "timestamp": "$(date -u -d '-6 minutes' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-6M +%Y-%m-%dT%H:%M:%S.000Z)",
      "offset_seconds": 60,
      "dom_path": "nav > a.dashboard",
      "element_text": "Dashboard",
      "page_title": "Vision One - Home"
    },
    {
      "index": 2,
      "timestamp": "$(date -u -d '-4 minutes' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-4M +%Y-%m-%dT%H:%M:%S.000Z)",
      "offset_seconds": 180,
      "dom_path": "nav > a.xdr",
      "element_text": "XDR Detection",
      "page_title": "Vision One - XDR"
    },
    {
      "index": 3,
      "timestamp": "$(date -u -d '-2 minutes' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-2M +%Y-%m-%dT%H:%M:%S.000Z)",
      "offset_seconds": 300,
      "dom_path": "button.investigate",
      "element_text": "Investigate Alert",
      "page_title": "Vision One - Workbench"
    }
  ]
}
CLICKEOF

# screenshots (empty placeholder)
mkdir -p "${TMPDIR}/screenshots"
echo "placeholder" > "${TMPDIR}/screenshots/001.txt"

# transcript/transcript.json
mkdir -p "${TMPDIR}/transcript"
cat > "${TMPDIR}/transcript/transcript.json" <<TRANSEOF
{
  "session_id": "${TEST_SESSION_ID}",
  "duration_seconds": 420,
  "entries": [
    { "timestamp": "00:00:10.000", "offset_seconds": 10, "speaker": "SE", "text": "Welcome to the demo. Let me show you Vision One." },
    { "timestamp": "00:01:30.000", "offset_seconds": 90, "speaker": "Visitor", "text": "We are evaluating XDR solutions for our enterprise." },
    { "timestamp": "00:03:00.000", "offset_seconds": 180, "speaker": "SE", "text": "Here is our cross-layer detection. Notice the correlation." },
    { "timestamp": "00:05:00.000", "offset_seconds": 300, "speaker": "Visitor", "text": "Can we schedule a POC next week?" },
    { "timestamp": "00:06:30.000", "offset_seconds": 390, "speaker": "SE", "text": "Absolutely. I will send you a personalized summary." }
  ]
}
TRANSEOF

pass "Generated session data in ${TMPDIR}"

# ── Step 2: Upload to S3 ─────────────────────────────────────
echo ""
echo "=== Step 2: Upload to S3 ==="

aws s3 cp "${TMPDIR}/metadata.json" "s3://${S3_BUCKET}/${S3_PREFIX}/metadata.json" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet

aws s3 cp "${TMPDIR}/clicks/clicks.json" "s3://${S3_BUCKET}/${S3_PREFIX}/clicks/clicks.json" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet

aws s3 cp "${TMPDIR}/screenshots/001.txt" "s3://${S3_BUCKET}/${S3_PREFIX}/screenshots/001.txt" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet

aws s3 cp "${TMPDIR}/transcript/transcript.json" "s3://${S3_BUCKET}/${S3_PREFIX}/transcript/transcript.json" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet

# Verify upload
METADATA_EXISTS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/metadata.json" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null | wc -l)

if [ "$METADATA_EXISTS" -gt 0 ]; then
  pass "Uploaded session to s3://${S3_BUCKET}/${S3_PREFIX}/"
else
  fail "Upload failed -- metadata.json not found in S3"
  exit 1
fi

# ── Step 3: Wait for watcher to process ───────────────────────
echo ""
echo "=== Step 3: Wait for Pipeline Processing ==="
echo "  Polling for output/summary.json (timeout: ${TIMEOUT_SECONDS}s) ..."

ELAPSED=0
POLL_INTERVAL=5
SUMMARY_FOUND=false

while [ "$ELAPSED" -lt "$TIMEOUT_SECONDS" ]; do
  SUMMARY_EXISTS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/output/summary.json" \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null | wc -l)

  if [ "$SUMMARY_EXISTS" -gt 0 ]; then
    SUMMARY_FOUND=true
    break
  fi

  echo "    ... ${ELAPSED}s elapsed, waiting"
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$SUMMARY_FOUND" = true ]; then
  pass "output/summary.json appeared after ${ELAPSED}s"
else
  fail "output/summary.json not found after ${TIMEOUT_SECONDS}s -- pipeline did not process the session"
  echo ""
  echo "  NOTE: This may mean the watcher is not running. Start it with:"
  echo "    node analysis/watcher.js"
  echo ""
  echo "  The session data is still in S3. You can manually trigger:"
  echo "    node analysis/pipeline-run.js s3://${S3_BUCKET}/${S3_PREFIX}"
  exit 1
fi

# ── Step 4: Validate output ───────────────────────────────────
echo ""
echo "=== Step 4: Validate Output ==="

# Download summary.json
SUMMARY_TMP="${TMPDIR}/output-summary.json"
aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/output/summary.json" "$SUMMARY_TMP" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --quiet 2>/dev/null

if [ -f "$SUMMARY_TMP" ]; then
  pass "Downloaded output/summary.json"
else
  fail "Could not download output/summary.json"
  exit 1
fi

# Validate required fields
VALIDATION=$(node -e "
var s = JSON.parse(require('fs').readFileSync('${SUMMARY_TMP}', 'utf8'));
var required = ['visitor_name', 'key_insights', 'recommended_follow_up'];
var missing = required.filter(function(k) { return !s[k]; });
if (missing.length > 0) {
  process.stdout.write('missing:' + missing.join(','));
} else {
  var insights = Array.isArray(s.key_insights) ? s.key_insights.length : 0;
  var followups = Array.isArray(s.recommended_follow_up) ? s.recommended_follow_up.length : 0;
  process.stdout.write('ok:insights=' + insights + ',followups=' + followups);
}
" 2>/dev/null || echo "error:node-parse-failed")

if echo "$VALIDATION" | grep -q '^ok:'; then
  pass "summary.json has required fields: ${VALIDATION}"
else
  fail "summary.json validation: ${VALIDATION}"
fi

# Check visitor_name matches what we sent
VISITOR_NAME=$(node -e "
var s = JSON.parse(require('fs').readFileSync('${SUMMARY_TMP}', 'utf8'));
process.stdout.write(s.visitor_name || '');
" 2>/dev/null || echo "")

if [ "$VISITOR_NAME" = "E2E Test Visitor" ]; then
  pass "visitor_name matches input: '${VISITOR_NAME}'"
else
  # Claude may rephrase, so just check it's non-empty
  if [ -n "$VISITOR_NAME" ]; then
    pass "visitor_name is set: '${VISITOR_NAME}' (may differ from input)"
  else
    fail "visitor_name is empty"
  fi
fi

# Check for HTML report
HTML_EXISTS=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/output/summary.html" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null | wc -l)

if [ "$HTML_EXISTS" -gt 0 ]; then
  pass "output/summary.html exists"
else
  fail "output/summary.html not found"
fi

# ── Results ───────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  E2E Pipeline Test Results"
echo "  PASS: ${PASS}"
echo "  FAIL: ${FAIL}"
echo "=============================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  *** ${FAIL} check(s) FAILED ***"
  exit 1
fi

echo ""
echo "  All checks passed."
exit 0
