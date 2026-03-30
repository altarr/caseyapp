#!/usr/bin/env bash
# Validate a completed S3 session has all required artifacts.
#
# Checks:
#   - metadata.json exists with required fields and status=completed/ended
#   - clicks/clicks.json exists and is valid JSON
#   - At least one screenshot in screenshots/
#   - transcript/transcript.json exists and is valid JSON
#   - output/summary.html exists
#
# Usage:
#   bash scripts/validate-session.sh <session_id>
#   bash scripts/validate-session.sh --verbose <session_id>
set -euo pipefail

###############################################################################
# Config
###############################################################################
BUCKET="boothapp-sessions-752266476357"
S3_BUCKET="s3://${BUCKET}"
AWS="aws --profile hackathon --region us-east-2"
VERBOSE=false

###############################################################################
# Args
###############################################################################
usage() {
  echo "Usage: $0 [--verbose] <session_id>"
  echo ""
  echo "Validates that an S3 session has all required artifacts."
  echo "Exits 0 if valid, 1 if any check fails."
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose|-v) VERBOSE=true; shift ;;
    --help|-h)    usage ;;
    -*)           echo "Unknown option: $1"; usage ;;
    *)            SESSION_ID="$1"; shift ;;
  esac
done

if [[ -z "${SESSION_ID:-}" ]]; then
  echo "Error: session_id is required"
  usage
fi

PREFIX="sessions/${SESSION_ID}"

###############################################################################
# Helpers
###############################################################################
PASS=0
FAIL=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

pass() { PASS=$((PASS + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); echo "[FAIL] $1"; }
info() { $VERBOSE && echo "[INFO] $1" || true; }

# Download an S3 file to TMP, return 0 if exists, 1 if not
s3_download() {
  local s3_path="$1"
  local local_name="$2"
  if ${AWS} s3 cp "${S3_BUCKET}/${PREFIX}/${s3_path}" "${TMP}/${local_name}" --quiet 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

# Check that a local JSON file is valid
json_valid() {
  python3 -c "import json; json.load(open('$1'))" 2>/dev/null
}

# Check a JSON file has a field
json_has_field() {
  local file="$1"
  local field="$2"
  python3 -c "
import json, sys
d = json.load(open('${file}'))
sys.exit(0 if '${field}' in d else 1)
" 2>/dev/null
}

# Get a JSON string field value
json_get() {
  local file="$1"
  local field="$2"
  python3 -c "
import json
d = json.load(open('${file}'))
print(d.get('${field}', ''))
" 2>/dev/null
}

###############################################################################
# Validation
###############################################################################
echo "=============================================="
echo " Session Validation: ${SESSION_ID}"
echo "=============================================="
echo ""

# --- 1. metadata.json ---
echo "--- metadata.json ---"
if s3_download "metadata.json" "metadata.json"; then
  pass "metadata.json exists"
else
  fail "metadata.json missing"
  echo ""
  echo "Results: ${PASS} passed, ${FAIL} failed"
  exit 1
fi

if json_valid "${TMP}/metadata.json"; then
  pass "metadata.json is valid JSON"
else
  fail "metadata.json is not valid JSON"
fi

METADATA_FIELDS="session_id visitor_name started_at ended_at status demo_pc se_name"
for field in $METADATA_FIELDS; do
  if json_has_field "${TMP}/metadata.json" "$field"; then
    info "metadata.json has '${field}': $(json_get "${TMP}/metadata.json" "$field")"
    pass "metadata.json has field '${field}'"
  else
    fail "metadata.json missing field '${field}'"
  fi
done

# Check status is completed or ended
STATUS=$(json_get "${TMP}/metadata.json" "status")
if [[ "$STATUS" == "completed" || "$STATUS" == "ended" ]]; then
  pass "metadata.json status is '${STATUS}'"
else
  fail "metadata.json status is '${STATUS}' (expected 'completed' or 'ended')"
fi

# --- 2. clicks/clicks.json ---
echo ""
echo "--- clicks/clicks.json ---"
if s3_download "clicks/clicks.json" "clicks.json"; then
  pass "clicks/clicks.json exists"
else
  fail "clicks/clicks.json missing"
fi

if [[ -f "${TMP}/clicks.json" ]]; then
  if json_valid "${TMP}/clicks.json"; then
    pass "clicks/clicks.json is valid JSON"

    # Check it has events (object with events array) or is an array
    EVENT_COUNT=$(python3 -c "
import json
d = json.load(open('${TMP}/clicks.json'))
if isinstance(d, list):
    print(len(d))
elif isinstance(d, dict) and 'events' in d:
    print(len(d['events']))
else:
    print(0)
" 2>/dev/null || echo "0")

    if [[ "$EVENT_COUNT" -gt 0 ]]; then
      pass "clicks.json has ${EVENT_COUNT} click events"
    else
      fail "clicks.json has no click events"
    fi
  else
    fail "clicks/clicks.json is not valid JSON"
  fi
fi

# --- 3. screenshots/ ---
echo ""
echo "--- screenshots/ ---"
SCREENSHOT_LIST=$(${AWS} s3 ls "${S3_BUCKET}/${PREFIX}/screenshots/" 2>/dev/null || true)
SCREENSHOT_COUNT=$(echo "$SCREENSHOT_LIST" | grep -c '\S' || true)

if [[ "$SCREENSHOT_COUNT" -gt 0 ]]; then
  pass "screenshots/ has ${SCREENSHOT_COUNT} file(s)"
  if $VERBOSE; then
    echo "$SCREENSHOT_LIST" | while read -r line; do
      [[ -n "$line" ]] && info "  $line"
    done
  fi
else
  fail "screenshots/ is empty or missing"
fi

# --- 4. transcript/transcript.json ---
echo ""
echo "--- transcript/transcript.json ---"
if s3_download "transcript/transcript.json" "transcript.json"; then
  pass "transcript/transcript.json exists"
else
  fail "transcript/transcript.json missing"
fi

if [[ -f "${TMP}/transcript.json" ]]; then
  if json_valid "${TMP}/transcript.json"; then
    pass "transcript/transcript.json is valid JSON"

    # Check it has entries
    ENTRY_COUNT=$(python3 -c "
import json
d = json.load(open('${TMP}/transcript.json'))
if isinstance(d, list):
    print(len(d))
elif isinstance(d, dict) and 'entries' in d:
    print(len(d['entries']))
else:
    print(0)
" 2>/dev/null || echo "0")

    if [[ "$ENTRY_COUNT" -gt 0 ]]; then
      pass "transcript.json has ${ENTRY_COUNT} entries"
    else
      fail "transcript.json has no entries"
    fi
  else
    fail "transcript/transcript.json is not valid JSON"
  fi
fi

# --- 5. output/summary.html ---
echo ""
echo "--- output/summary.html ---"
if ${AWS} s3 ls "${S3_BUCKET}/${PREFIX}/output/summary.html" >/dev/null 2>&1; then
  pass "output/summary.html exists"

  # Download and check it's non-empty HTML
  if s3_download "output/summary.html" "summary.html"; then
    SIZE=$(wc -c < "${TMP}/summary.html")
    if [[ "$SIZE" -gt 0 ]]; then
      pass "output/summary.html is non-empty (${SIZE} bytes)"
    else
      fail "output/summary.html is empty"
    fi
  fi
else
  fail "output/summary.html missing"
fi

###############################################################################
# Results
###############################################################################
echo ""
echo "=============================================="
echo " Results: ${PASS} passed, ${FAIL} failed"
echo " Session: ${SESSION_ID}"
echo "=============================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

echo ""
echo "Session is valid."
exit 0
