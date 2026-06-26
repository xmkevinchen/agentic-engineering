#!/bin/sh
# check-harness.sh — F-059: enforce the HDD runnable-check mandate.
# Every DETERMINISTIC verify_by AC (unit/integration/e2e/contract) MUST declare a
# runnable `verify:` line. judge/manual ACs are exempt (artifact/human, not shell).
# Answers exactly ONE question — does each deterministic AC have a runnable check —
# NOT coverage/adequacy/correctness (those belong to /ae:work + /ae:review).
#
# Usage: check-harness.sh <plan.md>
#   exit 0 = every deterministic AC has a runnable check
#   exit 1 = one or more deterministic ACs have no verify: line (Must-fix)
#   exit 2 = usage error
set -u
[ $# -eq 1 ] || { echo "usage: check-harness.sh <plan.md>" >&2; exit 2; }
plan="$1"
[ -f "$plan" ] || { echo "no such plan: $plan" >&2; exit 2; }

awk '
  function evalac() { if (ac != "" && det && !has) { print "  MISSING runnable check: " ac; bad++ } }
  /^### AC/   { evalac(); ac=$0; sub(/:.*/,"",ac); sub(/^### /,"",ac); det=0; has=0; next }
  /^##+ /     { evalac(); ac=""; det=0; has=0; next }   # any other heading ends the AC block
  /verify_by:[[:space:]]*(unit|integration|e2e|contract)/ { if (ac!="") det=1 }
  /^[[:space:]]*-?[[:space:]]*verify:/                     { if (ac!="") has=1 }
  END { evalac(); if (bad) exit 1 }
' "$plan"
rc=$?
[ "$rc" = 0 ] && echo "check-harness: OK (every deterministic AC has a runnable check)"
exit $rc
