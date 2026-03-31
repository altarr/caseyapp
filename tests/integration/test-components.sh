#!/usr/bin/env bash
# Integration tests -- verify boothapp components work together.
# Delegates to scripts/test/verify-integration.sh which does the real checks.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/scripts/test/verify-integration.sh"
