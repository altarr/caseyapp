#!/usr/bin/env bash
# Extension tests -- validate Chrome extension structure and content scripts.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

passed=0
failed=0

check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  PASS: $desc"
    passed=$((passed + 1))
  else
    echo "  FAIL: $desc"
    failed=$((failed + 1))
  fi
}

echo "Extension tests"
echo "==============="

# manifest.json exists and is valid JSON
check "manifest.json exists" test -f "$REPO_ROOT/extension/manifest.json"
check "manifest.json is valid JSON" node -e "JSON.parse(require('fs').readFileSync('$REPO_ROOT/extension/manifest.json','utf8'))"

# Required files referenced in manifest exist
check "background.js exists" test -f "$REPO_ROOT/extension/background.js"
check "content.js exists" test -f "$REPO_ROOT/extension/content.js"
check "popup.html exists" test -f "$REPO_ROOT/extension/popup.html"
check "popup.js exists" test -f "$REPO_ROOT/extension/popup.js"

# Manifest has required keys
check "manifest has manifest_version" node -e "
  const m = JSON.parse(require('fs').readFileSync('$REPO_ROOT/extension/manifest.json','utf8'));
  if (!m.manifest_version) process.exit(1);
"
check "manifest has permissions" node -e "
  const m = JSON.parse(require('fs').readFileSync('$REPO_ROOT/extension/manifest.json','utf8'));
  if (!m.permissions || !Array.isArray(m.permissions)) process.exit(1);
"

echo ""
echo "Results: $passed passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
