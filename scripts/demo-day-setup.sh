#!/usr/bin/env bash
# demo-day-setup.sh — One-command demo preparation.
#
# Runs preflight checks, uploads mock tenant pool, starts services,
# verifies health, and prints a status dashboard with URLs.
#
# Requires: aws CLI (profile: hackathon), node 18+
# Usage:    ./scripts/demo-day-setup.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Color output ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
AWS="aws --profile ${PROFILE} --region ${REGION}"

PIDS=()
SERVICES=()

cleanup() {
  if [ ${#PIDS[@]} -gt 0 ]; then
    printf "\n${YELLOW}Stopping services...${RESET}\n"
    for i in "${!PIDS[@]}"; do
      kill "${PIDS[$i]}" 2>/dev/null && printf "  Stopped ${SERVICES[$i]} (PID ${PIDS[$i]})\n"
    done
  fi
}
trap cleanup EXIT

header() {
  printf "\n${BOLD}=== %s ===${RESET}\n" "$1"
}

# ══════════════════════════════════════════════════════════════════════════════
printf "${BOLD}============================================================${RESET}\n"
printf "${BOLD}  BoothApp — Demo Day Setup${RESET}\n"
printf "  $(date)\n"
printf "${BOLD}============================================================${RESET}\n"

# ── Step 1: Preflight checks ─────────────────────────────────────────────────
header "Step 1/5: Preflight Checks"

if [ -f "${REPO_ROOT}/scripts/preflight.sh" ]; then
  if bash "${REPO_ROOT}/scripts/preflight.sh"; then
    printf "  ${GREEN}PASS${RESET}  All preflight checks passed\n"
  else
    printf "  ${RED}FAIL${RESET}  Preflight checks failed — fix issues above and re-run\n"
    exit 1
  fi
else
  # Minimal inline checks if preflight.sh missing
  printf "  ${YELLOW}WARN${RESET}  preflight.sh not found, running minimal checks\n"

  if ${AWS} sts get-caller-identity >/dev/null 2>&1; then
    printf "  ${GREEN}PASS${RESET}  AWS credentials valid\n"
  else
    printf "  ${RED}FAIL${RESET}  AWS credentials not configured\n"
    printf "        Run: aws configure --profile hackathon\n"
    exit 1
  fi

  if command -v node >/dev/null 2>&1; then
    printf "  ${GREEN}PASS${RESET}  Node.js $(node --version)\n"
  else
    printf "  ${RED}FAIL${RESET}  Node.js not found\n"
    exit 1
  fi
fi

# ── Step 2: Upload mock tenant pool ──────────────────────────────────────────
header "Step 2/5: Mock Tenant Pool"

if ${AWS} s3 ls "s3://${BUCKET}/tenant-pool/tenants.json" >/dev/null 2>&1; then
  printf "  ${GREEN}OK  ${RESET}  Tenant pool already exists in S3\n"
else
  if [ -f "${REPO_ROOT}/scripts/setup-demo-tenants.sh" ]; then
    printf "  Uploading mock tenant pool...\n"
    bash "${REPO_ROOT}/scripts/setup-demo-tenants.sh"
  else
    printf "  ${RED}FAIL${RESET}  setup-demo-tenants.sh not found\n"
    exit 1
  fi
fi

# ── Step 3: Install dependencies ─────────────────────────────────────────────
header "Step 3/5: Dependencies"

if [ -d "${REPO_ROOT}/node_modules/@aws-sdk" ]; then
  printf "  ${GREEN}OK  ${RESET}  node_modules present\n"
else
  printf "  Installing npm dependencies...\n"
  cd "${REPO_ROOT}" && npm install --production 2>&1 | tail -3
  printf "  ${GREEN}OK  ${RESET}  Dependencies installed\n"
fi

# ── Step 4: Start services ───────────────────────────────────────────────────
header "Step 4/5: Starting Services"

LOG_DIR="${REPO_ROOT}/logs"
mkdir -p "${LOG_DIR}"

# Start presenter server
printf "  Starting presenter server (port 3000)...\n"
S3_BUCKET="${BUCKET}" AWS_REGION="${REGION}" AWS_PROFILE="${PROFILE}" \
  node "${REPO_ROOT}/presenter/server.js" > "${LOG_DIR}/presenter.log" 2>&1 &
PIDS+=($!)
SERVICES+=("presenter")
printf "  ${GREEN}OK  ${RESET}  Presenter server PID $!\n"

# Start analysis watcher
printf "  Starting analysis watcher...\n"
S3_BUCKET="${BUCKET}" AWS_REGION="${REGION}" AWS_PROFILE="${PROFILE}" \
  node "${REPO_ROOT}/analysis/watcher.js" > "${LOG_DIR}/watcher.log" 2>&1 &
PIDS+=($!)
SERVICES+=("watcher")
printf "  ${GREEN}OK  ${RESET}  Analysis watcher PID $!\n"

# Give services a moment to start
sleep 2

# ── Step 5: Health checks ────────────────────────────────────────────────────
header "Step 5/5: Health Checks"

# Check presenter
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
  printf "  ${GREEN}PASS${RESET}  Presenter server healthy\n"
else
  printf "  ${YELLOW}WARN${RESET}  Presenter server not responding yet (check logs/presenter.log)\n"
fi

# Check S3 access
if ${AWS} s3 ls "s3://${BUCKET}/" >/dev/null 2>&1; then
  printf "  ${GREEN}PASS${RESET}  S3 bucket accessible\n"
else
  printf "  ${RED}FAIL${RESET}  S3 bucket not accessible\n"
fi

# Check tenant pool
if ${AWS} s3 ls "s3://${BUCKET}/tenant-pool/tenants.json" >/dev/null 2>&1; then
  printf "  ${GREEN}PASS${RESET}  Tenant pool loaded\n"
else
  printf "  ${YELLOW}WARN${RESET}  Tenant pool not found\n"
fi

# ══════════════════════════════════════════════════════════════════════════════
printf "\n${BOLD}============================================================${RESET}\n"
printf "${GREEN}${BOLD}  Demo Day Setup Complete!${RESET}\n"
printf "${BOLD}============================================================${RESET}\n"
printf "\n"
printf "${BOLD}  Services Running:${RESET}\n"
for i in "${!PIDS[@]}"; do
  printf "    %-20s PID %s\n" "${SERVICES[$i]}" "${PIDS[$i]}"
done
printf "\n"
printf "${BOLD}  URLs:${RESET}\n"
printf "    Create Session:  ${GREEN}http://localhost:3000/create-session.html${RESET}\n"
printf "    Dashboard:       http://localhost:3000/\n"
printf "    Analytics:       http://localhost:3000/analytics.html\n"
printf "    Demo Script:     http://localhost:3000/demo-script.html\n"
printf "    Session Viewer:  http://localhost:3000/session-viewer.html?session=<ID>\n"
printf "\n"
printf "${BOLD}  Logs:${RESET}\n"
printf "    Presenter:  ${LOG_DIR}/presenter.log\n"
printf "    Watcher:    ${LOG_DIR}/watcher.log\n"
printf "\n"
printf "${BOLD}  Quick Commands:${RESET}\n"
printf "    Run demo simulation:  bash scripts/run-demo.sh\n"
printf "    Cleanup after demo:   bash scripts/demo-cleanup.sh\n"
printf "    Stop services:        kill ${PIDS[*]:-}\n"
printf "\n"
printf "${BOLD}  Reminders:${RESET}\n"
printf "    1. Load Chrome extension in browser\n"
printf "    2. Plug in USB microphone\n"
printf "    3. Test create-session form with a dry run\n"
printf "\n"
printf "  Press Ctrl+C to stop all services.\n"
printf "\n"

# Keep script alive so trap cleanup works on Ctrl+C
trap cleanup INT
wait
