#!/usr/bin/env bash
# test-s3-setup.sh — Run the 5 verification tests for inf-01-s3-setup
# Usage: AWS_PROFILE=hackathon bash infra/test-s3-setup.sh
# Requires: aws CLI, curl

set -euo pipefail

PROFILE="${AWS_PROFILE:-hackathon}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws --profile "$PROFILE" sts get-caller-identity --query Account --output text)
BUCKET="boothapp-sessions-${ACCOUNT_ID}"
PASS=0
FAIL=0

ok()   { echo "  PASS: $1"; ((PASS++)); }
fail() { echo "  FAIL: $1"; ((FAIL++)); }

echo "=== inf-01-s3-setup verification ==="
echo "Bucket: $BUCKET"
echo ""

# ── Test 1: Upload a test file to sessions/test-123/clicks/test.json ──────
echo "[1] Upload test file to sessions/test-123/clicks/test.json"
echo '{"session_id":"test-123","events":[]}' > /tmp/inf01-test.json
if aws --profile "$PROFILE" --region "$REGION" s3 cp /tmp/inf01-test.json \
    "s3://${BUCKET}/sessions/test-123/clicks/test.json" --quiet 2>&1; then
  ok "Upload to sessions/test-123/clicks/test.json succeeded"
  # Cleanup
  aws --profile "$PROFILE" --region "$REGION" s3 rm \
      "s3://${BUCKET}/sessions/test-123/clicks/test.json" --quiet 2>/dev/null || true
else
  fail "Upload to sessions/test-123/clicks/test.json failed"
fi
rm -f /tmp/inf01-test.json

# ── Test 2: Lifecycle policy configured ───────────────────────────────────
echo "[2] Lifecycle policy configured"
LIFECYCLE=$(aws --profile "$PROFILE" --region "$REGION" \
    s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" 2>&1)
if echo "$LIFECYCLE" | grep -q "ExpireSessionData"; then
  EXPIRY=$(echo "$LIFECYCLE" | python3 -c "import sys,json; data=json.load(sys.stdin); \
    rules=[r for r in data['Rules'] if r['ID']=='ExpireSessionData']; \
    print(rules[0]['Expiration']['Days'])")
  ok "Lifecycle rule 'ExpireSessionData' found, expiry=${EXPIRY} days"
else
  fail "Lifecycle rule 'ExpireSessionData' not found — output: $LIFECYCLE"
fi

# ── Test 3: CORS allows PUT from chrome-extension:// origin ───────────────
echo "[3] CORS allows PUT from chrome-extension:// origin"
CORS=$(aws --profile "$PROFILE" --region "$REGION" \
    s3api get-bucket-cors --bucket "$BUCKET" 2>&1)
if echo "$CORS" | grep -q "chrome-extension://"; then
  ok "CORS rule includes chrome-extension:// origin"
else
  fail "CORS rule missing chrome-extension:// origin — output: $CORS"
fi
if echo "$CORS" | grep -q '"PUT"'; then
  ok "CORS rule allows PUT method"
else
  fail "CORS rule does not allow PUT — output: $CORS"
fi

# ── Test 4: Extension role can write clicks/ but not output/ ──────────────
echo "[4] Extension role policy: write clicks/ allowed, output/ denied"
EXT_POLICY=$(aws --profile "$PROFILE" --region "$REGION" iam get-policy-version \
    --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/boothapp-extension-policy" \
    --version-id "$(aws --profile "$PROFILE" --region "$REGION" iam list-policy-versions \
        --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/boothapp-extension-policy" \
        --query 'Versions[?IsDefaultVersion].VersionId' --output text)" \
    --query PolicyVersion.Document --output json 2>&1)

if echo "$EXT_POLICY" | grep -q "clicks/\*"; then
  ok "Extension policy allows write to clicks/*"
else
  fail "Extension policy does not include clicks/* write"
fi
if echo "$EXT_POLICY" | grep -q "screenshots/\*"; then
  ok "Extension policy allows write to screenshots/*"
else
  fail "Extension policy does not include screenshots/* write"
fi
if echo "$EXT_POLICY" | grep -q "output/\*"; then
  fail "Extension policy should NOT include output/* — it does"
else
  ok "Extension policy does not allow write to output/*"
fi

# ── Test 5: Analysis role can write output/ but not clicks/ ───────────────
echo "[5] Analysis role policy: write output/ allowed, clicks/ denied"
ANA_POLICY=$(aws --profile "$PROFILE" --region "$REGION" iam get-policy-version \
    --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/boothapp-analysis-policy" \
    --version-id "$(aws --profile "$PROFILE" --region "$REGION" iam list-policy-versions \
        --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/boothapp-analysis-policy" \
        --query 'Versions[?IsDefaultVersion].VersionId' --output text)" \
    --query PolicyVersion.Document --output json 2>&1)

if echo "$ANA_POLICY" | grep -q "output/\*"; then
  ok "Analysis policy allows write to output/*"
else
  fail "Analysis policy does not include output/* write"
fi
if echo "$ANA_POLICY" | grep -q "clicks/\*"; then
  fail "Analysis policy should NOT include clicks/* — it does"
else
  ok "Analysis policy does not allow write to clicks/*"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
