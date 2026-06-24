#!/bin/sh
# advance-node.sh <plan> <node-num> <id> <ledger> [iter] [cap] — F-054 Phase-1.
#
# The ONLY sanctioned way a `NODE_STATE <id>: pass` entry is written. It runs
# check-node.sh (which re-derives the verdict FROM DISK — files/git/test) and writes the
# ledger entry based SOLELY on check-node.sh's exit code. The caller (the work loop / LLM)
# cannot assert a pass: provenance is the exit code, not the caller's word. This closes the
# ledger-trust seam (codex P2-2) and preserves the F-050 anti-hallucination guarantee at the
# DAG layer — a ledger `pass` always corresponds to a real disk-re-derived verdict.
#
# Exit: 0 = node passed (ledger += pass) | 1 = failed (ledger += fail) | 2 = gate/human.
set -u

PLAN="${1:?usage: advance-node.sh <plan> <node-num> <id> <ledger> [iter] [cap]}"
NUM="${2:?node-num}"
ID="${3:?id}"
LEDGER="${4:?ledger}"
ITER="${5:-0}"
CAP="${6:-0}"
HERE=$(dirname "$0")

set +e
sh "$HERE/check-node.sh" "$PLAN" "$NUM" "$ITER" "$CAP" >/dev/null 2>&1
rc=$?
set -e 2>/dev/null || true

case "$rc" in
  0) verdict=pass ;;
  2) verdict=gate ;;
  *) verdict=fail ;;
esac
printf 'NODE_STATE %s: %s\n' "$ID" "$verdict" >> "$LEDGER"
echo "$verdict"
[ "$verdict" = pass ] && exit 0
[ "$verdict" = gate ] && exit 2
exit 1
