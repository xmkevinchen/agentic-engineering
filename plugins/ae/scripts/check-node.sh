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

# TRIGGER mode: `check-node.sh <plan> trigger` — the disk-derived loop-engagement check.
# Engage the harness loop iff the plan declares >=1 auto-node (a `human-gate: false` line,
# written by /ae:plan's derivation). No auto-node ⇒ legacy behavior (backward-compatible).
# This replaces the old verify_by-PRESENCE trigger that was forgeable by omission.
if [ "$STEP" = "trigger" ]; then
  if grep -qiE 'human-gate:[[:space:]]*false' "$PLAN"; then
    echo "engage: plan has >=1 auto-node (human-gate:false)"; exit 0
  fi
  echo "legacy: no auto-node (no human-gate:false) — no loop"; exit 1
fi

# Extract the "### Step N:" block (heading → next ### or ## or EOF).
block="$(awk -v s="$STEP" '
  $0 ~ ("^### Step " s ":") {f=1; print; next}
  f && (/^### / || /^## /) {exit}
  f {print}
' "$PLAN")"
[ -n "$block" ] || { echo "fail: step $STEP not found in $PLAN" >&2; exit 1; }

# GATE — node carries a judge/manual AC or an explicit human-gate: true (in the step
# block OR in any AC block the step references). Human-judged nodes do not auto-advance.
# F-051: anchor to metadata-position lines so a node_check `pattern=`/`expect=` value that
# happens to contain "verify_by: judge" cannot spuriously gate the node (codex review).
is_gate() { grep -qiE '^[[:space:]]*-?[[:space:]]*(human-gate:[[:space:]]*true|verify_by:[[:space:]]*(judge|manual))'; }
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

# F-051: per-node authored checks (node_check) — content gate beyond file presence.
# Each `node_check: <template> k=v ...` line is dispatched through the hardened runner.
# Red-before-green FIRST (the instance must demonstrably fail on a harness-synthesized bad
# input) THEN the real run. Absent node_check ⇒ this loop runs 0 times ⇒ legacy behavior.
RUNNER="$(dirname "$0")/run-node-check.sh"
if [ -f "$RUNNER" ]; then
  set +e  # a failing node_check makes the pipeline non-zero; we translate it below, not abort
  printf '%s\n' "$block" | sed -n 's/^[[:space:]]*node_check:[[:space:]]*//p' | while IFS= read -r spec; do
    [ -n "$spec" ] || continue
    # $spec is "<template> k=v k=v" — intentional word-split into runner args (values are
    # whitespace-free, v1). redcheck: 0=bites, 1=theater, 2=invalid (unknown template/param).
    set +e; sh "$RUNNER" redcheck $spec >/dev/null 2>&1; rrc=$?; set -e
    if [ "$rrc" -eq 2 ]; then echo "fail: node_check invalid: $spec" >&2; exit 12; fi
    if [ "$rrc" -ne 0 ]; then echo "fail: node_check theater (redcheck did not bite): $spec" >&2; exit 11; fi
    set +e; sh "$RUNNER" run $spec >/dev/null 2>&1; nrc=$?; set -e
    if [ "$nrc" -ne 0 ]; then echo "fail: node_check did not pass (rc=$nrc): $spec" >&2; exit 13; fi
  done
  # The while loop runs in a subshell (pipeline); a non-zero exit propagates as the pipeline rc.
  ncrc=$?
  set -e
  [ "$ncrc" -eq 0 ] || exit 1
fi
echo pass
exit 0
