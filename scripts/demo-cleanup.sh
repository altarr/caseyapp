#!/usr/bin/env bash
# demo-cleanup.sh — Clean up all demo resources from S3.
#
# Removes mock tenants, demo/sim sessions, commands, and active-session
# markers. Prompts for confirmation unless --force is passed.
#
# Requires: aws CLI (profile: hackathon)
# Usage:    ./scripts/demo-cleanup.sh [--force]
set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
AWS="aws --profile ${PROFILE} --region ${REGION}"

# ── Color output ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

FORCE=false
if [ "${1:-}" = "--force" ]; then
  FORCE=true
fi

TOTAL_DELETED=0

# ── Helper: delete S3 prefix and count objects ────────────────────────────────
delete_prefix() {
  local label="$1"
  local prefix="$2"
  local recursive="${3:-false}"

  # Count objects before deleting
  local count
  if [ "$recursive" = "true" ]; then
    count=$(${AWS} s3 ls "s3://${BUCKET}/${prefix}" --recursive 2>/dev/null | wc -l | tr -d ' ')
  else
    count=$(${AWS} s3 ls "s3://${BUCKET}/${prefix}" 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [ "${count}" -eq 0 ] 2>/dev/null; then
    printf "  ${YELLOW}SKIP${RESET}  %-40s (no objects found)\n" "${label}"
    return
  fi

  if [ "$recursive" = "true" ]; then
    ${AWS} s3 rm "s3://${BUCKET}/${prefix}" --recursive --quiet 2>/dev/null
  else
    ${AWS} s3 rm "s3://${BUCKET}/${prefix}" --quiet 2>/dev/null
  fi

  printf "  ${GREEN}DEL ${RESET}  %-40s %s objects\n" "${label}" "${count}"
  TOTAL_DELETED=$(( TOTAL_DELETED + count ))
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo ""
printf "${BOLD}============================================================${RESET}\n"
printf "${BOLD}  BoothApp — Demo Resource Cleanup${RESET}\n"
printf "  Bucket: s3://${BUCKET}\n"
printf "${BOLD}============================================================${RESET}\n"
echo ""

# List what will be deleted
printf "${BOLD}The following resources will be deleted:${RESET}\n"
echo "  1. tenant-pool/tenants.json"
echo "  2. tenant-pool/locks/ (recursive)"
echo "  3. active-session.json"
echo "  4. sessions/DEMO* (recursive)"
echo "  5. sessions/SIM* (recursive)"
echo "  6. commands/ (recursive)"
echo ""

# ── Confirm ───────────────────────────────────────────────────────────────────
if [ "$FORCE" != "true" ]; then
  printf "${YELLOW}Are you sure you want to delete all demo resources? [y/N]${RESET} "
  read -r CONFIRM
  if [ "${CONFIRM}" != "y" ] && [ "${CONFIRM}" != "Y" ]; then
    printf "\n${YELLOW}Aborted.${RESET}\n"
    exit 0
  fi
  echo ""
fi

printf "${BOLD}Deleting demo resources ...${RESET}\n\n"

# ── 1. tenant-pool/tenants.json ──────────────────────────────────────────────
delete_prefix "tenant-pool/tenants.json" "tenant-pool/tenants.json" "false"

# ── 2. tenant-pool/locks/ ────────────────────────────────────────────────────
delete_prefix "tenant-pool/locks/" "tenant-pool/locks/" "true"

# ── 3. active-session.json ───────────────────────────────────────────────────
delete_prefix "active-session.json" "active-session.json" "false"

# ── 4. sessions/DEMO* ────────────────────────────────────────────────────────
delete_prefix "sessions/DEMO*" "sessions/DEMO" "true"

# ── 5. sessions/SIM* ─────────────────────────────────────────────────────────
delete_prefix "sessions/SIM*" "sessions/SIM" "true"

# ── 6. commands/ ─────────────────────────────────────────────────────────────
delete_prefix "commands/" "commands/" "true"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
printf "${BOLD}--- Cleanup Summary ---${RESET}\n"
if [ "${TOTAL_DELETED}" -gt 0 ]; then
  printf "  ${GREEN}${TOTAL_DELETED} objects deleted${RESET}\n"
else
  printf "  ${YELLOW}No objects found to delete${RESET}\n"
fi
printf "${GREEN}${BOLD}Cleanup complete.${RESET}\n"
