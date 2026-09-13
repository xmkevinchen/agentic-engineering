#!/usr/bin/env bash
# test-artifact-root.sh — run read-artifact-root.py over the fixtures under
# tests/fixtures/artifact-root/, and (as steps are added) check-invocation-order.py and
# go-leash.sh against the same fixture family, resolving a configured root instead of `.ae`.
#
# expect_root   <fixture> <expected>            — exit 0, stdout equals <expected>
# expect_reject <fixture> <substr>...           — exit 2, and every substring present in output
#
# A substring is asserted rather than a count because the criterion these messages serve (AC4)
# asks that a reader can act on the message without running the reader again; "output was
# non-empty" would pass on a message that names nothing.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
READER="${READER_UNDER_TEST:-$ROOT/plugins/ae/scripts/read-artifact-root.py}"
HOOK="${HOOK_UNDER_TEST:-$ROOT/plugins/ae/scripts/check-invocation-order.py}"
FIXTURES="$ROOT/plugins/ae/tests/fixtures/artifact-root"

passed=0
failed=0

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

expect_root() {
  local fixture=$1 expected=$2 pipeline out code
  pipeline="$FIXTURES/$fixture/.claude/pipeline.yml"
  out=$(python3 "$READER" "$pipeline" 2>&1)
  code=$?
  if [ "$code" -ne 0 ]; then
    report fail "$fixture resolves to $expected" "exit $code
$out"
    return
  fi
  if [ "$out" != "$expected" ]; then
    report fail "$fixture resolves to $expected" "got: $out"
    return
  fi
  report pass "$fixture resolves to $expected"
}

expect_reject() {
  local fixture=$1 pipeline out code missing=""
  shift
  pipeline="$FIXTURES/$fixture/.claude/pipeline.yml"
  out=$(python3 "$READER" "$pipeline" 2>&1)
  code=$?
  if [ "$code" -eq 0 ]; then
    report fail "$fixture is rejected" "exit 0, printed: $out"
    return
  fi
  for needle in "$@"; do
    case "$out" in
      *"$needle"*) ;;
      *) missing="$missing
  says nothing about: $needle" ;;
    esac
  done
  if [ -n "$missing" ]; then
    report fail "$fixture is rejected with a useful message" "$missing
full output: $out"
    return
  fi
  report pass "$fixture is rejected with a useful message"
}

echo "== read-artifact-root.py =="
expect_root "absent" ".ae"
expect_root "no-key" ".ae"
expect_root "configured" "agent-memory"
expect_root "configured-trailing-slash" "agent-memory"
expect_reject "malformed-empty" "artifact_root"
expect_reject "malformed-absolute" "artifact_root" "/absolute/path"
expect_reject "malformed-escape" "artifact_root" ".."
expect_reject "malformed-mapping" "artifact_root"

invoke_hook() {
  # $1=cwd $2=skill $3=args
  python3 -c '
import json, sys
print(json.dumps({"cwd": sys.argv[1], "tool_input": {"skill": sys.argv[2], "args": sys.argv[3]}}))
' "$1" "$2" "$3" | python3 "$HOOK"
}

expect_hook() {
  local desc=$1 expected_code=$2 cwd=$3 skill=$4 args=$5 out code missing=""
  shift 5
  out=$(invoke_hook "$cwd" "$skill" "$args" 2>&1)
  code=$?
  if [ "$code" -ne "$expected_code" ]; then
    report fail "$desc" "expected exit $expected_code, got $code
$out"
    return
  fi
  for needle in "$@"; do
    case "$out" in
      *"$needle"*) ;;
      *) missing="$missing
  says nothing about: $needle" ;;
    esac
  done
  if [ -n "$missing" ]; then
    report fail "$desc (message check)" "$missing
full output: $out"
    return
  fi
  report pass "$desc"
}

echo
echo "== check-invocation-order.py =="
expect_hook "default root, no config: bare F-NNN resolves under .ae, complete predecessor allows" \
  0 "$FIXTURES/hook-default" "ae:plan" "F-2-good"
expect_hook "configured root: bare F-NNN resolves under agent-memory (not the complete .ae sibling), incomplete predecessor refuses" \
  2 "$FIXTURES/hook-root-conflict" "ae:plan" "F-1-good"
expect_hook "configured root: full configured-root path resolves the same incomplete feature" \
  2 "$FIXTURES/hook-root-conflict" "ae:plan" "agent-memory/features/active/F-1-good"
expect_hook "malformed root: refuses rather than guessing, before trying to resolve anything" \
  2 "$FIXTURES/hook-malformed-root" "ae:plan" "F-1-good" "artifact_root"

echo
echo "passed=$passed failed=$failed"
[ "$failed" -eq 0 ]
