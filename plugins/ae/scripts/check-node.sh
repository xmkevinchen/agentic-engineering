#!/bin/sh
# check-node.sh <plan-file> <step-num> [iter cap] — F-050
# Re-derive ONE plan node's verdict FROM DISK (never trust agent self-report).
#   gate (exit 2) = the node is a human-gate (any judge/manual AC, or human-gate: true)
#                   OR the fixup cap is exhausted on an auto-node (escalate to human)
#   fail (exit 1) = an Expected-files deliverable is missing on disk
#   pass (exit 0) = auto-node AND all Expected-files present
# MVP scope: node-deliverable presence = Expected-files exist on disk. The green-gate
# (test.command rerun) stays the loop's EXISTING hedge — not duplicated here. Finer
# per-AC test mapping is a future BL. This script is the advance/gate decision; it composes
# UPSTREAM of loop-decide.sh (gate bypasses loop-decide; pass/fail feed the existing loop).
set -eu

PLAN="${1:?usage: check-node.sh <plan-file> <step-num> [iter cap]}"
STEP="${2:?step number}"
ITER="${3:-0}"
CAP="${4:-0}"
[ -f "$PLAN" ] || { echo "fail: plan not found: $PLAN" >&2; exit 1; }

# Extract the "### Step N:" block (heading → next ### or ## or EOF).
block="$(awk -v s="$STEP" '
  $0 ~ ("^### Step " s ":") {f=1; print; next}
  f && (/^### / || /^## /) {exit}
  f {print}
' "$PLAN")"
[ -n "$block" ] || { echo "fail: step $STEP not found in $PLAN" >&2; exit 1; }

# GATE — node carries a judge/manual AC or an explicit human-gate: true (in the step
# block OR in any AC block the step references). Human-judged nodes do not auto-advance.
is_gate() { grep -qiE 'human-gate:[[:space:]]*true|verify_by:[[:space:]]*(judge|manual)'; }
if printf '%s\n' "$block" | is_gate; then echo gate; exit 2; fi
for ac in $(printf '%s\n' "$block" | grep -oE 'AC[0-9]+' | sort -u); do
  acblock="$(awk -v a="### $ac" 'index($0,a)==1{f=1;print;next} f&&(/^### /||/^## /){exit} f{print}' "$PLAN")"
  if printf '%s\n' "$acblock" | is_gate; then echo gate; exit 2; fi
done

# ESCALATE — auto-node whose fixup cap is exhausted (regret fix): hand to human via gate.
if [ "$CAP" -gt 0 ] && [ "$ITER" -ge "$CAP" ]; then
  echo "gate: fixup cap $CAP exhausted at iter $ITER (escalate to human)"; exit 2
fi

# AUTO node — re-derive from disk: every Expected-files deliverable must exist.
exp="$(printf '%s\n' "$block" | sed -n 's/^Expected files:[[:space:]]*//p' | head -1)"
[ -n "$exp" ] || { echo "fail: step $STEP declares no Expected files (drift=unknown)" >&2; exit 1; }
missing=""
oldIFS=$IFS; IFS=','
for f in $exp; do
  IFS=$oldIFS
  f="$(printf '%s' "$f" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$f" ] && { IFS=','; continue; }
  [ -e "$f" ] || missing="$missing $f"
  IFS=','
done
IFS=$oldIFS
if [ -n "$missing" ]; then echo "fail: missing deliverables:$missing" >&2; exit 1; fi
echo pass
exit 0
