#!/bin/sh
# ae-flow-controller.sh — F-041: full-net controller (v0.5).
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
# Re-work: /ae:work has a fixup-mode (F-041) triggered by this loop's re-work directive
# ("Review returned verdict: fail. Address these findings"), so re-work re-engages a
# done (all-[x]) plan with findings-driven fixup commits (plus /ae:review's own fixup).
# The stall-detector still bounds non-converging cases.
#
# DEFERRED to later slices: verifier-discovery (auto-find a verifier when test.command
# empty), FULL auto-reactivation watcher (only transient-degraded auto-retry is in),
# per-task accumulated-knowledge in the pause record.
#
# FULL NET (v0.5): given a feature-dir (a NEED), the controller runs the front half
# (analyze -> info-gain arbiter -> plan -> plan-review) THEN the back half (work <-> review).
# The front half IS the per-need "dynamic harness design" step. Given a reviewed-plan path
# it skips straight to the back half (front gates pass through). Front-half = human-gated more
# (design decisions surface as pauses, front-loaded); back-half = autonomous.
#
# Usage:  sh ae-flow-controller.sh <feature-dir | reviewed-plan-path>   (DRY=1 → logic-only)
#         MAX_ROUNDS=N (re-work bound, default 2).
# Outcome: pass | analyze-incomplete | plan-not-reviewed | work-stalled | missing-verifier |
#          unknown-drift | degraded-review | review-fail | review-fail-stalled | dead-end
set -u

ARG="${1:?usage: ae-flow-controller.sh <feature-dir | reviewed-plan-path>}"
if [ -d "$ARG" ]; then FEATURE_DIR="${ARG%/}"; PLAN="$FEATURE_DIR/plan.md"
else PLAN="$ARG"; FEATURE_DIR="$(dirname "$PLAN")"; fi
[ -d "$FEATURE_DIR" ] || { echo "OUTCOME: dead-end (feature dir not found: $FEATURE_DIR)"; exit 2; }
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

# (FRONT HALF — analyze + plan gates — runs below, after the helpers are defined)

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

# ===== FRONT HALF (per-need dynamic design: analyze -> plan; human-gated more) =====
# The front half IS the dynamic-harness-design step: analyze establishes what the need
# requires, plan (incl. plan-review) emits the fit-for-purpose execution. Low-reversibility
# design decisions surface here as front-half pauses (human-front-loaded), per the autonomy posture.
plan_reviewed() { grep -q '^status:[[:space:]]*reviewed' "$PLAN" 2>/dev/null || grep -q '^status:[[:space:]]*done' "$PLAN" 2>/dev/null; }
ARBITER_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"

# analyze gate: produce analysis if missing, then gate with the info-gain arbiter
[ -f "$FEATURE_DIR/analysis.md" ] || run_stage "/ae:analyze $FEATURE_DIR" >/dev/null 2>&1 || true
if [ -f "$FEATURE_DIR/analysis.md" ]; then
  DRY="${DRY:-0}" sh "$ARBITER_DIR/ae-analyze-arbiter.sh" "$FEATURE_DIR/analysis.md" >/dev/null 2>&1 \
    || pause analyze analyze-incomplete "analysis failed the info-gain arbiter (uncertainty high / load-bearing assumptions unflagged)" \
          "deepen analysis or run a spike (re-run /ae:analyze); settle open design decisions via /ae:discuss; then resume"
elif [ "${DRY:-0}" != 1 ]; then
  pause analyze analyze-incomplete "no analysis.md produced for the need" "run /ae:analyze on the need, then resume"
fi

# plan gate: produce + review the plan if not yet reviewed (this IS the per-need design)
plan_reviewed || run_stage "/ae:plan $FEATURE_DIR" >/dev/null 2>&1 || true
plan_reviewed || pause plan plan-not-reviewed "no reviewed plan after /ae:plan (design decisions may remain)" \
      "settle design via /ae:discuss or /ae:plan-review the draft, then resume"

# ===== BACK HALF (autonomous: work <-> review) =====
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
