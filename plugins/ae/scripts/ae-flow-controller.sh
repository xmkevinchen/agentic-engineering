#!/bin/sh
# ae-flow-controller.sh — F-041 slice 1: autonomous back-half controller (v0.2).
#
# Deterministic loop driving REAL AE skills (/ae:work, /ae:review) via `claude -p`,
# advancing on ARTIFACT arbiters (plan [x] count; review.md `verdict:`). The human does
# NOT dispatch each stage — the controller does, pausing only on a first-class non-pass
# outcome. Smallest bottom-up slice of the F-041 spiral-ascent vision
# (.ae/features/active/F-041-*/harness-net-vision.md).
#
# Substrate (feasibility-spiked + live-validated 2026-06-18): claude -p runs real AE
# skills + emits parseable output; arbiters read from FILES for determinism (not stdout).
#
# SCOPE GUARD (arbiter-pass != release authority): confined to local worktree + the two
# skills. NEVER push/merge/PR/deploy. /ae:work makes local commits (reversible checkpoint).
#
# PAUSE + RE-ACTIVATION (v0.2): on any non-pass outcome the controller persists a
# `.flow-pause.md` record (stage/outcome/reason/unblock/resume) in the feature dir and
# prints a one-step unblock + the resume command. RESUME = re-invoke on the same plan;
# because arbiters read artifacts, resume is idempotent (re-reads current state, advances
# from where it is). A clean run leaves no pause file. (Advanced: auto-reactivation
# watcher = later slice.)
#
# SCOPE: single-pass (work -> review-once -> pass | pause). DEFERRED to later slices:
# loop-back on verdict fail, finer outcome split (missing-verifier / unknown-drift),
# verifier-discovery, auto-reactivation, per-task accumulated-knowledge in the record.
#
# Usage:  sh ae-flow-controller.sh <reviewed-plan-path>     (DRY=1 → logic-only, no claude -p)
# Outcome: pass | work-stalled | degraded-review | review-fail | dead-end
set -u

PLAN="${1:?usage: ae-flow-controller.sh <reviewed-plan-path>}"
[ -f "$PLAN" ] || { echo "OUTCOME: dead-end (plan not found: $PLAN)"; exit 2; }
FEATURE_DIR="$(dirname "$PLAN")"
PAUSE_FILE="$FEATURE_DIR/.flow-pause.md"

now() { date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown; }

# pause: persist a re-activation record + print the one-step unblock, then exit.
pause() { # $1=stage $2=outcome $3=reason $4=unblock-instruction
  cat > "$PAUSE_FILE" <<EOF
# Flow paused — re-activation record
paused_at: $(now)
stage: $1
outcome: $2
reason: $3
unblock: $4
resume: sh plugins/ae/scripts/ae-flow-controller.sh "$PLAN"
EOF
  echo "OUTCOME: $2 ($3)"
  echo "  unblock: $4"
  echo "  resume:  sh plugins/ae/scripts/ae-flow-controller.sh \"$PLAN\""
  exit 1
}

# Each invocation clears the prior pause record (resume re-evaluates fresh); pause()
# re-writes it if we pause again; a clean pass leaves none.
rm -f "$PAUSE_FILE"

# --- prerequisite: plan reviewed (its own arbiter already passed) ---
grep -q '^status:[[:space:]]*reviewed' "$PLAN" || grep -q '^status:[[:space:]]*done' "$PLAN" || {
  echo "OUTCOME: dead-end (plan not reviewed)"
  echo "  unblock: run /ae:plan-review $PLAN, then resume"; exit 2; }

# --- deterministic, file-based arbiters ---
work_done()      { ! grep -q '^- \[ \]' "$PLAN"; }                                  # zero unchecked boxes
review_verdict() {
  # /ae:review archives feature active->done ON PASS, so review.md moves. Resolve both.
  rm_path="$FEATURE_DIR/review.md"
  [ -f "$rm_path" ] || rm_path="$(printf '%s' "$FEATURE_DIR" | sed 's#/features/active/#/features/done/#')/review.md"
  grep -m1 '^verdict:' "$rm_path" 2>/dev/null | sed 's/^verdict:[[:space:]]*//'
}
run_stage() {
  if [ "${DRY:-0}" = 1 ]; then echo "[flow][dry] would dispatch: claude -p \"$1\"" >&2; return 0; fi
  echo "[flow] dispatch: claude -p \"$1\"" >&2
  claude -p "$1" 2>&1
}

# ---- WORK ----
work_out="$(run_stage "/ae:work $PLAN")"
if ! work_done; then
  case "$work_out" in
    *"degraded mode"*|*"cross-family"*[Uu]navailable*)
      pause work degraded-review "cross-family unavailable after fallback during work" \
            "restore cross-family (codex/gemini) or accept Claude-only, then resume";;
    *) printf '%s\n' "$work_out" | tail -8 >&2
       pause work work-stalled "plan still has unchecked steps after /ae:work (see log)" \
             "inspect the blocker in the log; fix it (or the plan), then resume";;
  esac
fi

# ---- REVIEW ----
review_out="$(run_stage "/ae:review $PLAN")"
case "$review_out" in
  *"degraded mode"*|*"cross-family unavailable"*)
    pause review degraded-review "review ran cross-family-degraded" \
          "restore cross-family or accept Claude-only review, then resume";;
esac

v="$(review_verdict)"
if [ "$v" = "pass" ]; then
  echo "OUTCOME: pass (work green + review verdict pass; archived to done/; ready for human handoff — NOT pushed/merged)"
  exit 0
fi
pause review review-fail "review verdict='${v:-none}' (loop-back deferred to a later slice)" \
      "address findings in $FEATURE_DIR/review.md, then resume"
