#!/bin/sh
# append-synthesis-trace.sh — F-026 Step 4: /ae:discuss per-round synthesis-gate trace emitter
#
# Emits 1 NDJSON record per Round N synthesis write to ~/.ae/traces/<session-id>.ndjson.
# Distinct from write-trace.sh (which emits 1 record per skill invocation, 9-field schema v1.2)
# — this script emits multiple records per /ae:discuss invocation, 9-field shape including
# `record_type: synthesis-gate` discriminator so consumers (`/ae:plugin-stats`, future tools)
# can route by record type alongside T1's 9-field per-invocation records in the same stream.
#
# Background: F-026 plan-review round-2 Codex F5 + Gemini #4 convergent finding — Falsifiable
# Success Criterion is unfalsifiable without a tool to emit the per-round metric records.
# Ships concurrently with Steps 1+2+3 to close the ship-measured gap.
#
# Args (positional, all required, all integers):
#   $1 — round              (Round N of the discussion)
#   $2 — n_mechanisms       (count of mechanisms in the merged Round N output)
#   $3 — n_pruned           (count of Pruned: entries in this round's synthesis)
#   $4 — n_retained_with_rationale     (count of Retained: entries with verbatim AC-quote)
#   $5 — n_retained_without_rationale  (count of Retained: entries lacking verbatim quote — MUST stay 0)
#   $6 — n_strictly_needed_estimate    (scope-reducer's denominator estimate, or -1 if unavailable)
#
# Environment:
#   AE_SESSION_ID — session id (optional; fallback chain: AE_SESSION_ID → CLAUDE_CODE_SESSION_ID → CC_SESSION_ID)
#
# Behavior: POSIX shell, graceful skip on missing session id or arg-count error, never fails the caller.

set -u

# ---- Resolve session id via the canonical adapter chain ----
: "${AE_SESSION_ID:=${CLAUDE_CODE_SESSION_ID:-${CC_SESSION_ID:-}}}"
if [ -z "$AE_SESSION_ID" ]; then
  echo "[append-synthesis-trace] skip: AE_SESSION_ID unset (no session adapter resolved)" >&2
  exit 0
fi

# ---- Arg validation (positional, exactly 6 integers) ----
if [ $# -ne 6 ]; then
  echo "[append-synthesis-trace] skip: expected 6 args, got $# — usage: $0 <round> <n_mechanisms> <n_pruned> <n_retained_with_rationale> <n_retained_without_rationale> <n_strictly_needed_estimate>" >&2
  exit 0
fi

round=$1
n_mechanisms=$2
n_pruned=$3
n_retained_with_rationale=$4
n_retained_without_rationale=$5
n_strictly_needed_estimate=$6

# ---- Resolve trace dir + ensure it exists ----
trace_dir="${HOME}/.ae/traces"
mkdir -p "$trace_dir" 2>/dev/null || {
  echo "[append-synthesis-trace] skip: mkdir failed for $trace_dir" >&2
  exit 0
}

trace_file="${trace_dir}/${AE_SESSION_ID}.ndjson"

# ---- Timestamp (ISO 8601 UTC, second precision — matches write-trace.sh idiom) ----
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# ---- Emit single-line NDJSON record (fixed-shape; no shell-injection risk because all fields are
#      integers or fixed enum strings — no user-provided text fields) ----
printf '{"ts":"%s","record_type":"synthesis-gate","skill":"ae:discuss","round":%s,"n_mechanisms":%s,"n_pruned":%s,"n_retained_with_rationale":%s,"n_retained_without_rationale":%s,"n_strictly_needed_estimate":%s}\n' \
  "$ts" "$round" "$n_mechanisms" "$n_pruned" "$n_retained_with_rationale" "$n_retained_without_rationale" "$n_strictly_needed_estimate" \
  >> "$trace_file"

exit 0
