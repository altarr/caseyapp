#!/usr/bin/env bash
# setup-demo-pc.sh — Interactive setup wizard for a fresh BoothApp demo PC.
# Checks prerequisites, installs extension (manual), creates .env, tests connectivity.
# Exit 0 = all good. Exit 1 = something needs fixing.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Colors ---
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf "  ${GREEN}[OK]${RESET}   %s\n" "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf "  ${RED}[FAIL]${RESET} %s\n" "$1"
  if [ -n "${2:-}" ]; then
    printf "         ${YELLOW}> %s${RESET}\n" "$2"
  fi
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf "  ${YELLOW}[WARN]${RESET} %s\n" "$1"
}

info() {
  printf "  ${CYAN}[INFO]${RESET} %s\n" "$1"
}

header() {
  printf "\n${BOLD}=== STEP %s: %s ===${RESET}\n" "$1" "$2"
}

prompt_value() {
  local varname="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local value=""

  if [ -n "${default_val}" ]; then
    printf "  ${CYAN}%s${RESET} [${default_val}]: " "${prompt_text}"
  else
    printf "  ${CYAN}%s${RESET}: " "${prompt_text}"
  fi
  read -r value
  if [ -z "${value}" ] && [ -n "${default_val}" ]; then
    value="${default_val}"
  fi
  eval "${varname}=\"${value}\""
}

# =====================================================================
header "1" "Check Chrome Installation"
# =====================================================================

CHROME_FOUND=false

# Check common Chrome locations (Windows via Git Bash, macOS, Linux)
CHROME_PATHS=(
  "/c/Program Files/Google/Chrome/Application/chrome.exe"
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

for cpath in "${CHROME_PATHS[@]}"; do
  if [ -f "${cpath}" ]; then
    CHROME_FOUND=true
    pass "Chrome found at: ${cpath}"
    break
  fi
done

# Try which/command lookup
if ! ${CHROME_FOUND}; then
  if command -v google-chrome >/dev/null 2>&1; then
    CHROME_FOUND=true
    pass "Chrome found: $(command -v google-chrome)"
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    CHROME_FOUND=true
    pass "Chrome found: $(command -v google-chrome-stable)"
  elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME_FOUND=true
    pass "Chromium found: $(command -v chromium-browser)"
  fi
fi

if ! ${CHROME_FOUND}; then
  fail "Chrome not found" "Install from https://www.google.com/chrome/"
fi

# =====================================================================
header "2" "Install Chrome Extension (Developer Mode)"
# =====================================================================

EXT_DIR="${REPO_ROOT}/extension"
MANIFEST="${EXT_DIR}/manifest.json"

if [ -f "${MANIFEST}" ]; then
  EXT_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${MANIFEST}','utf8')).name)" 2>/dev/null || echo "V1-Helper")
  pass "Extension manifest found: ${EXT_NAME}"

  printf "\n"
  printf "  ${BOLD}To install the extension in Chrome:${RESET}\n"
  printf "  ${CYAN}1.${RESET} Open Chrome and go to: ${BOLD}chrome://extensions${RESET}\n"
  printf "  ${CYAN}2.${RESET} Toggle ${BOLD}Developer mode${RESET} ON (top-right switch)\n"
  printf "  ${CYAN}3.${RESET} Click ${BOLD}Load unpacked${RESET}\n"
  printf "  ${CYAN}4.${RESET} Select this folder:\n"
  printf "         ${BOLD}${EXT_DIR}${RESET}\n"
  printf "  ${CYAN}5.${RESET} Verify the extension icon appears in the toolbar\n"
  printf "  ${CYAN}6.${RESET} Pin it for easy access during demos\n"
  printf "\n"

  if ${CHROME_FOUND}; then
    printf "  ${YELLOW}Press Enter after you have loaded the extension...${RESET}"
    read -r
    pass "Extension installation acknowledged"
  else
    warn "Chrome not installed -- skip extension install for now"
  fi
else
  fail "Extension manifest not found at ${MANIFEST}" "Run this from the repo root"
fi

# =====================================================================
header "3" "Create .env Configuration"
# =====================================================================

ENV_FILE="${REPO_ROOT}/.env"
ENV_EXAMPLE="${REPO_ROOT}/.env.example"

if [ -f "${ENV_FILE}" ]; then
  info ".env already exists -- skipping creation"
  info "To recreate: rm ${ENV_FILE} and re-run this script"
  pass ".env file present"
else
  if [ ! -f "${ENV_EXAMPLE}" ]; then
    fail ".env.example not found" "Expected at ${ENV_EXAMPLE}"
  else
    printf "\n  ${BOLD}Configure environment variables:${RESET}\n"
    printf "  (Press Enter to accept defaults shown in brackets)\n\n"

    prompt_value ENV_AWS_PROFILE  "AWS profile name"              "hackathon"
    prompt_value ENV_AWS_REGION   "AWS region"                    "us-east-1"
    prompt_value ENV_S3_BUCKET    "S3 bucket name"                "boothapp-sessions-752266476357"
    prompt_value ENV_ANALYSIS_MODEL "Analysis model"              "claude-sonnet-4-6"
    prompt_value ENV_AUDIO_DEVICE "Audio device (blank=auto)"     ""

    # Copy .env.example as base, then override prompted values
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    sed -i "s|^AWS_PROFILE=.*|AWS_PROFILE=${ENV_AWS_PROFILE}|" "${ENV_FILE}"
    sed -i "s|^AWS_REGION=.*|AWS_REGION=${ENV_AWS_REGION}|" "${ENV_FILE}"
    sed -i "s|^S3_BUCKET=.*|S3_BUCKET=${ENV_S3_BUCKET}|" "${ENV_FILE}"
    sed -i "s|^ANALYSIS_MODEL=.*|ANALYSIS_MODEL=${ENV_ANALYSIS_MODEL}|" "${ENV_FILE}"
    if [ -n "${ENV_AUDIO_DEVICE}" ]; then
      sed -i "s|^# AUDIO_DEVICE=.*|AUDIO_DEVICE=${ENV_AUDIO_DEVICE}|" "${ENV_FILE}"
    fi

    pass ".env created at ${ENV_FILE}"
    printf "\n"
  fi
fi

# Source .env for subsequent checks
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# =====================================================================
header "4" "Test S3 Connectivity"
# =====================================================================

if ! command -v aws >/dev/null 2>&1; then
  fail "AWS CLI not installed" "Install from https://aws.amazon.com/cli/"
else
  pass "AWS CLI found"

  PROFILE_FLAG=""
  if [ -n "${AWS_PROFILE:-}" ]; then
    PROFILE_FLAG="--profile ${AWS_PROFILE}"
  fi

  # Test credentials
  # shellcheck disable=SC2086
  if CALLER=$(aws sts get-caller-identity ${PROFILE_FLAG} --query 'Account' --output text 2>&1); then
    pass "AWS credentials valid (account: ${CALLER})"
  else
    fail "AWS credentials not working" "${CALLER}"
  fi

  # Test bucket access
  BUCKET="${S3_BUCKET:-boothapp-sessions-752266476357}"
  # shellcheck disable=SC2086
  if aws s3 ls "s3://${BUCKET}/" ${PROFILE_FLAG} --max-items 1 >/dev/null 2>&1; then
    pass "S3 bucket ${BUCKET} accessible"
  else
    fail "S3 bucket ${BUCKET} not accessible" "Check bucket name and IAM permissions (s3:ListBucket)"
  fi
fi

# =====================================================================
header "5" "Test Audio Device Detection"
# =====================================================================

if ! command -v ffmpeg >/dev/null 2>&1; then
  fail "ffmpeg not installed" "Install: apt install ffmpeg / brew install ffmpeg / choco install ffmpeg"
else
  FFMPEG_VER=$(ffmpeg -version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
  pass "ffmpeg available (${FFMPEG_VER:-unknown})"

  # Try to list audio devices -- platform-dependent
  DEVICES_FOUND=false

  # Windows (dshow)
  if ffmpeg -list_devices true -f dshow -i dummy 2>&1 | grep -q '(audio)'; then
    info "Detected audio devices (DirectShow):"
    ffmpeg -list_devices true -f dshow -i dummy 2>&1 | grep '(audio)' | while IFS= read -r line; do
      printf "         %s\n" "${line}"
    done
    DEVICES_FOUND=true
  fi

  # Linux (ALSA)
  if ! ${DEVICES_FOUND} && [ -f /proc/asound/cards ]; then
    if [ -s /proc/asound/cards ]; then
      info "Detected audio devices (ALSA):"
      while IFS= read -r line; do
        printf "         %s\n" "${line}"
      done < /proc/asound/cards
      DEVICES_FOUND=true
    fi
  fi

  # macOS (avfoundation)
  if ! ${DEVICES_FOUND} && [ "$(uname)" = "Darwin" ]; then
    AVDEVICES=$(ffmpeg -list_devices true -f avfoundation -i dummy 2>&1 | grep -A 100 'audio devices' | grep '^\[' || true)
    if [ -n "${AVDEVICES}" ]; then
      info "Detected audio devices (AVFoundation):"
      echo "${AVDEVICES}" | while IFS= read -r line; do
        printf "         %s\n" "${line}"
      done
      DEVICES_FOUND=true
    fi
  fi

  if ${DEVICES_FOUND}; then
    pass "Audio devices detected"
  else
    warn "No audio input devices found (expected on headless/server systems)"
    info "Connect a USB mic before the demo and re-run this script"
  fi
fi

# =====================================================================
# Additional checks
# =====================================================================

printf "\n${BOLD}=== Additional Checks ===${RESET}\n"

# Node.js
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version 2>/dev/null)
  pass "Node.js ${NODE_VER}"
else
  fail "Node.js not found" "Install from https://nodejs.org/"
fi

# Python 3
if command -v python3 >/dev/null 2>&1; then
  PY_VER=$(python3 --version 2>/dev/null)
  pass "${PY_VER}"
else
  fail "Python 3 not found" "Install from https://python.org/"
fi

# .gitignore includes .env
if [ -f "${REPO_ROOT}/.gitignore" ]; then
  if grep -q '\.env' "${REPO_ROOT}/.gitignore" 2>/dev/null; then
    pass ".env is in .gitignore"
  else
    warn ".env is NOT in .gitignore -- add it to prevent committing secrets"
  fi
fi

# =====================================================================
# Summary
# =====================================================================
TOTAL=$((PASS_COUNT + FAIL_COUNT))
printf "\n${BOLD}--- Results ---${RESET}\n"
printf "  ${GREEN}%d passed${RESET}  /  " "${PASS_COUNT}"
if [ "${FAIL_COUNT}" -gt 0 ]; then
  printf "${RED}%d failed${RESET}  /  " "${FAIL_COUNT}"
fi
if [ "${WARN_COUNT}" -gt 0 ]; then
  printf "${YELLOW}%d warnings${RESET}  /  " "${WARN_COUNT}"
fi
printf "%d total\n\n" "${TOTAL}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  printf "${RED}${BOLD}SETUP INCOMPLETE${RESET} -- fix the failures above and re-run.\n"
  exit 1
else
  printf "${GREEN}${BOLD}DEMO PC READY${RESET} -- all prerequisites met!\n"
  exit 0
fi
