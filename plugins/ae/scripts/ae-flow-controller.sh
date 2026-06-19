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
# LOOP-BACK (v0.3): on review-fail the controller runs a bounded re-work<->re-review
# loop (MAX_ROUNDS, default 2) feeding the review findings back as guidance, with a
# STALL DETECTOR (review.md signature unchanged across a round = no progress -> escalate).
# Caveat: /ae:work refuses all-[x] plans, so re-work currently leans on /ae:review's
# OWN fixup across rounds (fresh fixup budget per invocation -> code changes -> sig moves);
# a /ae:work fixup-mode that re-engages a done plan is a deferred follow-up.
#
# DEFERRED to later slices: finer outcome split (missing-verifier / unknown-drift),
# verifier-discovery, auto-reactivation watcher, /ae:work fixup-mode, per-task
# accumulated-knowledge in the pause record.
#
# Usage:  sh ae-flow-controller.sh <reviewed-plan-path>     (DRY=1 → logic-only, no claude -p)
#         MAX_ROUNDS=N to bound re-work rounds (default 2).
# Outcome: pass | work-stalled | degraded-review | review-fail | review-fail-stalled | dead-end
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
review_sig() {  # signature of current review findings, to detect a no-progress stall
  rm_path="$FEATURE_DIR/review.md"
  if [ -f "$rm_path" ]; then cksum < "$rm_path"; else echo none; fi
}
MAX_ROUNDS="${MAX_ROUNDS:-2}"   # bounded re-work rounds after a review-fail before escalating
run_stage() {
  if [ "${DRY:-0}" = 1 ]; then echo "[flow][dry] would dispatch: claude -p \"$1\"" >&2; return 0; fi
  echo "[flow] dispatch: claude -p \"$1\"" >&2
  claude -p "$1" 2>&1
}

# ---- WORK ----
work_out="$(run_stage "/ae:work $PLAN")"
if ! work_done; then
  printf '%s\n' "$work_out" | tail -8 >&2
  case "$work_out" in
    *"degraded mode"*|*"cross-family"*[Uu]navailable*)
      pause work degraded-review "cross-family unavailable after fallback during work" \
            "restore cross-family (codex/gemini) or accept Claude-only, then resume";;
    *"No test command"*|*UNVERIFIED*)
      pause work missing-verifier "no verifier: tests UNVERIFIED, auto-pass cannot confirm work" \
            "set test.command in pipeline.yml (or add a verifier the work step runs), then resume";;
    *[Dd]rift*|*"Expected files"*)
      pause work unknown-drift "work paused on a drift / Expected-files issue" \
            "review the drift in the log; fix the plan's Expected files or revert stray changes, then resume";;
    *) pause work work-stalled "plan still has unchecked steps after /ae:work (see log)" \
             "inspect the blocker in the log; fix it (or the plan), then resume";;
  esac
fi

# ---- REVIEW <-> RE-WORK loop (bounded + stall-detected) ----
round=0; prev_sig=""; degraded_retries=0
RETRY_DEGRADED="${RETRY_DEGRADED:-2}"   # auto-reactivation: re-try a transient degraded review before escalating
while :; do
  review_out="$(run_stage "/ae:review $PLAN")"
  case "$review_out" in
    *"degraded mode"*|*"cross-family unavailable"*)
      degraded_retries=$((degraded_retries + 1))
      if [ "$degraded_retries" -le "$RETRY_DEGRADED" ]; then
        echo "[flow] review degraded → auto-retry $degraded_retries/$RETRY_DEGRADED (cross-family may recover)" >&2
        continue
      fi
      pause review degraded-review "review cross-family-degraded after $RETRY_DEGRADED auto-retries" \
            "restore cross-family or accept Claude-only review, then resume";;
  esac

  v="$(review_verdict)"
  if [ "$v" = "pass" ]; then
    echo "OUTCOME: pass (work green + review verdict pass; archived to done/; ready for human handoff — NOT pushed/merged)"
    exit 0
  fi

  # review failed → bounded loop-back with stall detection
  round=$((round + 1))
  sig="$(review_sig)"
  if [ "$round" -gt "$MAX_ROUNDS" ]; then
    pause review review-fail "verdict='${v:-none}' after $MAX_ROUNDS re-work rounds" \
          "address findings in $FEATURE_DIR/review.md, then resume"
  fi
  if [ -n "$prev_sig" ] && [ "$sig" = "$prev_sig" ]; then
    pause review review-fail-stalled "no progress: identical review findings across rounds (re-work not converging)" \
          "address findings in $FEATURE_DIR/review.md manually, then resume"
  fi
  prev_sig="$sig"

  # re-work with the review findings as guidance, then loop back to re-review
  echo "[flow] verdict=$v → loop-back round $round/$MAX_ROUNDS (re-work with findings)" >&2
  findings="$(cat "$FEATURE_DIR/review.md" 2>/dev/null)"
  run_stage "/ae:work $PLAN

Review returned verdict: fail. Address these findings, then re-verify:
$findings" >/dev/null 2>&1 || true
done
