#!/usr/bin/env bash
# run-tests.sh -- Comprehensive test runner for boothapp.
#
# Runs all test suites and reports results with color-coded pass/fail.
#
# Usage:
#   bash scripts/run-tests.sh                        # run all suites
#   bash scripts/run-tests.sh --suite unit            # run only unit tests
#   bash scripts/run-tests.sh --suite integration     # run only integration tests
#   bash scripts/run-tests.sh --verbose               # show full test output
#   bash scripts/run-tests.sh --suite unit --verbose   # combine flags
#
# Suites: unit, integration, e2e, extension, smoke

set -uo pipefail

###############################################################################
# Config
###############################################################################
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERBOSE=false
FILTER=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --suite)   FILTER="$2"; shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    -h|--help)
      sed -n '2,/^$/{ s/^# //; s/^#//; p }' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

###############################################################################
# Colors (disabled if not a terminal)
###############################################################################
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  GREEN='' RED='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

###############################################################################
# Suite definitions: name -> command
###############################################################################
declare -A SUITE_CMD
SUITE_CMD[unit]="node tests/unit/test-validator.js"
SUITE_CMD[integration]="bash tests/integration/test-components.sh"
SUITE_CMD[e2e]="bash tests/e2e/test-full-pipeline.sh --dry-run"
SUITE_CMD[extension]="bash tests/extension/test-extension.sh"
SUITE_CMD[smoke]="bash tests/smoke/test-smoke.sh"

# Ordered list (bash associative arrays don't preserve order)
SUITE_ORDER=(unit integration e2e extension smoke)

###############################################################################
# Runner
###############################################################################
total=0
pass=0
fail=0
skipped=0
declare -A RESULTS
START_TIME=$(date +%s)

run_suite() {
  local name="$1"
  local cmd="${SUITE_CMD[$name]}"

  printf "${BOLD}${CYAN}[%s]${RESET} Running %s tests...\n" "$(echo "$name" | tr '[:lower:]' '[:upper:]')" "$name"

  # Check if the test script file exists (second token for bash/node commands)
  local test_file
  test_file=$(echo "$cmd" | awk '{print $2}')
  if [[ ! -f "$REPO_ROOT/$test_file" ]]; then
    printf "  ${YELLOW}SKIP${RESET}: %s not found\n\n" "$test_file"
    skipped=$((skipped + 1))
    RESULTS[$name]="SKIP"
    return
  fi

  total=$((total + 1))

  local suite_start rc output
  suite_start=$(date +%s)

  cd "$REPO_ROOT"
  if $VERBOSE; then
    set +e
    eval "$cmd"
    rc=$?
    set -e
  else
    set +e
    output=$(eval "$cmd" 2>&1)
    rc=$?
    set -e
  fi

  local suite_end duration
  suite_end=$(date +%s)
  duration=$((suite_end - suite_start))

  if [[ $rc -eq 0 ]]; then
    printf "  ${GREEN}PASS${RESET} (%ds)\n\n" "$duration"
    pass=$((pass + 1))
    RESULTS[$name]="PASS"
  else
    printf "  ${RED}FAIL${RESET} (exit code %d, %ds)\n" "$rc" "$duration"
    if ! $VERBOSE && [[ -n "${output:-}" ]]; then
      echo "  --- output ---"
      echo "$output" | sed 's/^/  | /'
      echo "  --- end ---"
    fi
    printf "\n"
    fail=$((fail + 1))
    RESULTS[$name]="FAIL"
  fi
}

# Determine which suites to run
if [[ -n "$FILTER" ]]; then
  if [[ -z "${SUITE_CMD[$FILTER]+x}" ]]; then
    echo "Unknown suite: $FILTER"
    echo "Available: ${SUITE_ORDER[*]}"
    exit 1
  fi
  suites_to_run=("$FILTER")
else
  suites_to_run=("${SUITE_ORDER[@]}")
fi

###############################################################################
# Header
###############################################################################
printf "\n${BOLD}========================================${RESET}\n"
printf "${BOLD}  boothapp test runner${RESET}\n"
printf "${BOLD}========================================${RESET}\n\n"

# Run suites
for suite in "${suites_to_run[@]}"; do
  run_suite "$suite"
done

###############################################################################
# Summary
###############################################################################
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

printf "${BOLD}========================================${RESET}\n"
printf "${BOLD}  SUMMARY${RESET}\n"
printf "${BOLD}========================================${RESET}\n\n"

for suite in "${suites_to_run[@]}"; do
  local_result="${RESULTS[$suite]:-SKIP}"
  case "$local_result" in
    PASS) printf "  ${GREEN}PASS${RESET}  %s\n" "$suite" ;;
    FAIL) printf "  ${RED}FAIL${RESET}  %s\n" "$suite" ;;
    SKIP) printf "  ${YELLOW}SKIP${RESET}  %s\n" "$suite" ;;
  esac
done

printf "\n"
printf "  Suites:   %d total, ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}, ${YELLOW}%d skipped${RESET}\n" \
  "$((total + skipped))" "$pass" "$fail" "$skipped"
printf "  Duration: %ds\n\n" "$TOTAL_DURATION"

if [[ $fail -gt 0 ]]; then
  printf "${RED}${BOLD}TESTS FAILED${RESET}\n\n"
  exit 1
else
  printf "${GREEN}${BOLD}ALL TESTS PASSED${RESET}\n\n"
  exit 0
fi
