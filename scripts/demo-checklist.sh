#!/usr/bin/env bash
#
# demo-checklist.sh -- Verify all BoothApp components are ready for demo day.
# Exit 0 only if every check passes.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Config (mirrors infra/config.py)
AWS_PROFILE="hackathon"
AWS_REGION="us-east-1"
SESSION_BUCKET="boothapp-sessions-752266476357"
LAMBDA_FUNCTION="boothapp-session-watcher"

PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== BoothApp Demo-Day Checklist ==="
echo ""

# -----------------------------------------------------------------------
# 1. S3 bucket accessible with AWS creds
# -----------------------------------------------------------------------
echo "-- AWS / S3 --"

check "AWS CLI installed" command -v aws

check "AWS credentials valid (profile: $AWS_PROFILE)" \
  aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION"

check "S3 bucket '$SESSION_BUCKET' accessible" \
  aws s3api head-bucket --bucket "$SESSION_BUCKET" --profile "$AWS_PROFILE" --region "$AWS_REGION"

echo ""

# -----------------------------------------------------------------------
# 2. Lambda function exists and responds
# -----------------------------------------------------------------------
echo "-- Lambda --"

check "Lambda '$LAMBDA_FUNCTION' exists" \
  aws lambda get-function --function-name "$LAMBDA_FUNCTION" --profile "$AWS_PROFILE" --region "$AWS_REGION"

# Invoke with a dry-run (DryRun invocation type validates permissions without executing)
check "Lambda '$LAMBDA_FUNCTION' invocable (dry-run)" \
  aws lambda invoke --function-name "$LAMBDA_FUNCTION" \
    --invocation-type DryRun \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    /dev/null

echo ""

# -----------------------------------------------------------------------
# 3. Chrome extension manifest.json is valid
# -----------------------------------------------------------------------
echo "-- Chrome Extension --"

MANIFEST="$PROJECT_ROOT/extension/manifest.json"

check "manifest.json exists" test -f "$MANIFEST"

check "manifest.json is valid JSON" python3 -c "
import json, sys
json.load(open('$MANIFEST'))
"

check "manifest.json has required MV3 fields" python3 -c "
import json, sys
m = json.load(open('$MANIFEST'))
required = ['manifest_version', 'name', 'version', 'permissions', 'background', 'content_scripts']
missing = [k for k in required if k not in m]
if missing:
    print('Missing: ' + ', '.join(missing), file=sys.stderr)
    sys.exit(1)
if m.get('manifest_version') != 3:
    print('manifest_version is not 3', file=sys.stderr)
    sys.exit(1)
"

echo ""

# -----------------------------------------------------------------------
# 4. Audio recorder package.json has all deps installed
# -----------------------------------------------------------------------
echo "-- Audio Recorder --"

AUDIO_DIR="$PROJECT_ROOT/audio"

check "audio/package.json exists" test -f "$AUDIO_DIR/package.json"

check "audio/node_modules present" test -d "$AUDIO_DIR/node_modules"

check "Audio deps installed (no missing)" bash -c "
  cd '$AUDIO_DIR'
  # npm ls exits non-zero if any declared dep is missing
  ! npm ls --omit=dev 2>&1 | grep -q 'missing\|ELACKDEPS\|ERR!'
"

echo ""

# -----------------------------------------------------------------------
# 5. Analysis pipeline can import all modules
# -----------------------------------------------------------------------
echo "-- Analysis Pipeline --"

ANALYSIS_DIR="$PROJECT_ROOT/analysis"

check "analysis/requirements.txt exists" test -f "$ANALYSIS_DIR/requirements.txt"

check "Python deps installed (anthropic, boto3)" python3 -c "
import anthropic, boto3
"

check "Pipeline modules importable" bash -c "
  cd '$ANALYSIS_DIR'
  python3 -c '
from engines.analyzer import SessionAnalyzer
from engines.claude_client import get_client
from engines.prompts import SYSTEM_FACTUAL
from engines.timeline_builder import build_timeline
'
"

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
