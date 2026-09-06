#!/usr/bin/env bash
# test-stage-delivery.sh — run check-stage-delivery.py over the fixtures under
# tests/fixtures/stage-delivery/ and assert what it says, not merely that it said something.
#
# Every fixture is a feature directory sitting under a state directory, so the checker resolves
# the features root the same way it does on a real tree: <fixture>/<state>/<F-NNN-slug>/.
#
# expect_ok   <fixture> <stage>              — exit 0
# expect_bad  <fixture> <stage> <substr>...  — exit 1, and every substring present in the output
#
# A substring is asserted rather than a count because the criterion the messages serve asks that
# a reader can finish the missing part without running the stage again; "output was non-empty"
# would pass on a message that names nothing.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CHECK="$ROOT/plugins/ae/scripts/check-stage-delivery.py"
FIXTURES="$ROOT/plugins/ae/tests/fixtures/stage-delivery"

passed=0
failed=0

fixture_dir() {
  # a fixture holds exactly one feature directory, under whichever state directory it uses
  find "$FIXTURES/$1" -mindepth 2 -maxdepth 2 -type d | head -1
}

report() {
  if [ "$1" = pass ]; then
    passed=$((passed + 1))
    printf '  ok   %s\n' "$2"
  else
    failed=$((failed + 1))
    printf '  FAIL %s\n' "$2"
    printf '%s\n' "$3" | sed 's/^/       /'
  fi
}

expect_ok() {
  local fixture=$1 stage=$2 dir out code
  dir=$(fixture_dir "$fixture")
  out=$(python3 "$CHECK" "$dir" "$stage" 2>&1)
  code=$?
  if [ "$code" -eq 0 ]; then
    report pass "$fixture ($stage) exits 0"
  else
    report fail "$fixture ($stage) exits 0" "exit $code
$out"
  fi
}

expect_bad() {
  local fixture=$1 stage=$2 dir out code missing=""
  shift 2
  dir=$(fixture_dir "$fixture")
  out=$(python3 "$CHECK" "$dir" "$stage" 2>&1)
  code=$?
  if [ "$code" -ne 1 ]; then
    report fail "$fixture ($stage) exits 1" "exit $code
$out"
    return
  fi
  for needle in "$@"; do
    case "$out" in
      *"$needle"*) ;;
      *) missing="$missing
  message never says: $needle" ;;
    esac
  done
  if [ -z "$missing" ]; then
    report pass "$fixture ($stage) exits 1 and names what is wrong"
  else
    report fail "$fixture ($stage) exits 1 and names what is wrong" "$missing

$out"
  fi
}

echo "ANALYZE — a legitimate ending is distinguishable from an interrupted run"
expect_ok  analyze-delivered      analyze
expect_ok  analyze-blocked        analyze
expect_ok  analyze-nothing-to-do  analyze
expect_ok  analyze-not-one-item   analyze
expect_bad analyze-interrupted    analyze \
  analyze acceptance.md ended: nothing-to-do

echo "AC4 — the artifact on disk decides, not an account of it"
expect_bad analyze-interrupted-with-claiming-log analyze \
  analyze acceptance.md ended:

echo "PLAN, WORK, REVIEW — the same distinction, one deliverable each"
expect_ok  plan-delivered            plan
expect_ok  plan-criterion-unplannable plan
expect_ok  plan-check-green-first    plan
expect_ok  plan-input-refused        plan
expect_bad plan-interrupted          plan   plan "plan.md" ended: criterion-unplannable

expect_ok  work-delivered            work
expect_ok  work-blocked              work
expect_ok  work-criterion-defective  work
expect_bad work-interrupted          work   work "log.md" ended: blocked

expect_ok  review-delivered          review
expect_ok  review-blocked            review
expect_bad review-interrupted        review review "review.md" ended: blocked

echo
printf '%d passed, %d failed\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
