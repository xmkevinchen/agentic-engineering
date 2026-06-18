#!/bin/sh
# ae-flow-controller.sh — F-041 slice 1: autonomous back-half controller (v0.1, single-pass).
#
# Deterministic loop driving REAL AE skills (/ae:work, /ae:review) via `claude -p`,
# advancing on ARTIFACT arbiters (plan [x] count; review.md `verdict:`). The human does
# NOT dispatch each stage — the controller does, pausing only on a first-class non-pass
# outcome. This is the smallest bottom-up slice of the F-041 spiral-ascent vision
# (see .ae/features/active/F-041-*/harness-net-vision.md).
#
# Substrate (decided by feasibility spike, 2026-06-18): claude -p runs real AE skills
# and emits parseable output; arbiters read from FILES for determinism (not stdout).
#
# SCOPE GUARD (codex Q3 — arbiter-pass != release authority): this controller confines
# itself to the local worktree + invoking the two skills. It NEVER runs push / merge /
# PR / deploy. /ae:work makes LOCAL commits (the allowed guarded checkpoint, reversible);
# push/merge/PR stay human-gated and the AE skills already honor that.
#
# v0.1 SCOPE: single-pass (work -> review-once -> pass | escalate). DEFERRED to later
# slices: loop-back on verdict fail (re-work semantics are non-trivial), finer outcome
# classification (missing-verifier / unknown-drift split), verifier-discovery.
#
# Usage:  sh ae-flow-controller.sh <reviewed-plan-path>
# Final line:  OUTCOME: <pass | work-stalled | degraded-review | review-fail | dead-end>
set -u

PLAN="${1:?usage: ae-flow-controller.sh <reviewed-plan-path>}"
[ -f "$PLAN" ] || { echo "OUTCOME: dead-end (plan not found: $PLAN)"; exit 2; }
FEATURE_DIR="$(dirname "$PLAN")"
REVIEW="$FEATURE_DIR/review.md"

# --- prerequisite: plan must be reviewed (its own arbiter already passed) ---
grep -q '^status:[[:space:]]*reviewed' "$PLAN" || grep -q '^status:[[:space:]]*done' "$PLAN" || {
  echo "OUTCOME: dead-end (plan not reviewed; run plan-review first)"; exit 2; }

# --- deterministic, file-based arbiters ---
work_done()      { ! grep -q '^- \[ \]' "$PLAN"; }                                  # zero unchecked boxes
review_verdict() {
  # LIVE-RUN FINDING (2026-06-18): /ae:review archives the feature active->done ON
  # PASS (its Completion Invariant mv), so review.md moves out of the active path.
  # Resolve from active/ first, then the done/ equivalent.
  rm_path="$FEATURE_DIR/review.md"
  [ -f "$rm_path" ] || rm_path="$(printf '%s' "$FEATURE_DIR" | sed 's#/features/active/#/features/done/#')/review.md"
  grep -m1 '^verdict:' "$rm_path" 2>/dev/null | sed 's/^verdict:[[:space:]]*//'
}

run_stage() {
  # DRY=1 → validate the deterministic arbiter/branch logic without the heavy
  # claude -p nested sessions (no side effects, no commits).
  if [ "${DRY:-0}" = 1 ]; then echo "[flow][dry] would dispatch: claude -p \"$1\"" >&2; return 0; fi
  echo "[flow] dispatch: claude -p \"$1\"" >&2
  claude -p "$1" 2>&1
}

# ---- WORK stage ----
work_out="$(run_stage "/ae:work $PLAN")"
if ! work_done; then
  case "$work_out" in
    *"degraded mode"*|*"cross-family"*[Uu]navailable*) echo "OUTCOME: degraded-review"; exit 1;;
    *) printf '%s\n' "$work_out" | tail -8 >&2
       echo "OUTCOME: work-stalled (plan still has unchecked steps; see log above)"; exit 1;;
  esac
fi

# ---- REVIEW stage ----
review_out="$(run_stage "/ae:review $PLAN")"
case "$review_out" in
  *"degraded mode"*|*"cross-family unavailable"*) echo "OUTCOME: degraded-review"; exit 1;;
esac

v="$(review_verdict)"
if [ "$v" = "pass" ]; then
  echo "OUTCOME: pass (work green + review verdict pass; ready for human handoff — NOT pushed/merged)"
  exit 0
fi

# v0.1: no loop-back yet (deferred). Verdict fail/absent -> escalate to human.
echo "OUTCOME: review-fail (verdict='${v:-none}'; loop-back deferred to a later slice → escalate to human)"
exit 1
