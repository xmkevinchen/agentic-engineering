#!/bin/sh
# dag-next.sh <plan> <ledger> — F-055 thin DAG driver.
#
# Collapses the deterministic orchestration of the DAG work loop into one call: compute the
# ready-set, pick the next node, do commit-before-execute, and emit a single instruction.
# It does NOT do node work (the LLM's irreducible part) and does NOT decide verdicts (that
# stays advance-node.sh → check-node.sh, disk-re-derived). It only automates the
# orchestration DECISION — the deterministic skeleton — shrinking the TL's per-step residual.
#
# Output / exit:
#   LEGACY            (exit 0) — plan has no `dag: true`; caller uses linear mode.
#   DONE              (exit 0) — every node is pass.
#   BLOCKED           (exit 3) — a node is gate-escalated and blocks the frontier (needs human).
#   NEXT <id> <step#> (exit 0) — do this node's work, then advance-node.sh. The ledger has been
#                                appended `NODE_STATE <id>: in_progress` (commit-before-execute).
set -u

PLAN="${1:?usage: dag-next.sh <plan> <ledger>}"
LEDGER="${2:?usage: dag-next.sh <plan> <ledger>}"
HERE=$(dirname "$0")
[ -f "$PLAN" ] || { echo "fail: plan not found: $PLAN" >&2; exit 1; }

if ! grep -qiE '^dag:[[:space:]]*true[[:space:]]*$' "$PLAN"; then echo LEGACY; exit 0; fi

out=$(sh "$HERE/check-dag.sh" "$PLAN" ready "$LEDGER" 2>/dev/null); rc=$?
[ "$out" = "__DONE__" ] && { echo DONE; exit 0; }
{ [ "$rc" = 3 ] || [ "$out" = "__BLOCKED__" ]; } && { echo BLOCKED; exit 3; }

id=$(printf '%s\n' "$out" | head -1)
[ -n "$id" ] || { echo BLOCKED; exit 3; }

# Map id -> `### Step N` number (within the ## Steps section) so the caller can run check-node.
num=$(awk -v want="$id" '
  function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/,"",s); return s }
  /^##[[:space:]]/ { insteps=($0 ~ /^##[[:space:]]+Steps([[:space:]]|$)/)?1:0 }
  insteps && /^###[[:space:]]+Step[[:space:]]+/ { t=$0; sub(/^###[[:space:]]+Step[[:space:]]+/,"",t); sub(/[:.].*$/,"",t); curnum=trim(t) }
  insteps && /^id:[[:space:]]/ { v=$0; sub(/^id:[[:space:]]*/,"",v); if(trim(v)==want){ print curnum; exit } }
' "$PLAN")
[ -n "$num" ] || num=0

printf 'NODE_STATE %s: in_progress\n' "$id" >> "$LEDGER"   # commit-before-execute (automated)
echo "NEXT $id $num"
exit 0
