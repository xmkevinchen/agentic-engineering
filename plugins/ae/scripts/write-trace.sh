#!/bin/sh
# write-trace.sh — Plan 054 Step 2: T1 trace NDJSON emitter
#
# Emits 1 record per skill invocation to ~/.ae/traces/<session-id>.ndjson
# Schema version: 1.2 (9 fields). Full spec: docs/references/trace-schema.md
#
# Inputs (env vars + file paths; producer = SKILL.md final emission step):
#   AE_TRACE_SKILL          - "ae:work" / "ae:review" / etc.
#   AE_TRACE_FEATURE_ID     - "F-NNN" or empty
#   AE_TRACE_OUTCOME        - pass | fail | cancelled | unavailable
#   AE_TRACE_FAMILIES_FILE  - path to JSON array file: [{"family":"...","state":"..."}]
#   AE_TRACE_VERDICTS_FILE  - path to JSON object file: {"codex":"approved",...}
#   AE_TRACE_DIFF_PATHS_FILE - path to newline-separated paths file
#   AE_SESSION_ID           - session id adapter (optional; chain: AE_SESSION_ID -> CLAUDE_CODE_SESSION_ID -> CC_SESSION_ID -> uuidgen)
#
# Behavior: POSIX shell + mkdir-as-lock atomic critical section (replaces flock for macOS portability).
# Graceful: missing env / files / jq / git → warn to stderr, exit 0 (non-blocking).

set -u  # error on unset (paranoid)

# ---- Resolve required inputs (graceful skip if missing) ----
REQUIRED_VARS="AE_TRACE_SKILL AE_TRACE_OUTCOME AE_TRACE_FAMILIES_FILE AE_TRACE_VERDICTS_FILE AE_TRACE_DIFF_PATHS_FILE"
for v in $REQUIRED_VARS; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then
    echo "[trace] skip: required env var $v is empty/unset" >&2
    exit 0
  fi
done

for f in "$AE_TRACE_FAMILIES_FILE" "$AE_TRACE_VERDICTS_FILE" "$AE_TRACE_DIFF_PATHS_FILE"; do
  if [ ! -f "$f" ]; then
    echo "[trace] skip: input file missing: $f" >&2
    exit 0
  fi
done

# AE_TRACE_FEATURE_ID can be empty (null → consumer skip)
AE_TRACE_FEATURE_ID="${AE_TRACE_FEATURE_ID:-}"

# ---- Resolve PROJECT_ROOT ----
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# ---- Session ID adapter chain ----
SESSION_ID_SOURCE="explicit"
RESOLVED_SESSION_ID="${AE_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-${CC_SESSION_ID:-}}}"
if [ -z "$RESOLVED_SESSION_ID" ]; then
  if command -v uuidgen >/dev/null 2>&1; then
    RESOLVED_SESSION_ID="$(uuidgen)"
  else
    RESOLVED_SESSION_ID="generated-$(date -u +%s)-$$"
  fi
  SESSION_ID_SOURCE="generated"
fi

# ---- Sanitize session id for filename (path traversal defense) ----
SESSION_ID_SAFE="$(printf '%s' "$RESOLVED_SESSION_ID" | tr -c 'A-Za-z0-9_-' '_')"
if [ -z "$SESSION_ID_SAFE" ]; then
  if command -v uuidgen >/dev/null 2>&1; then
    SESSION_ID_SAFE="$(uuidgen)"
  else
    SESSION_ID_SAFE="emergency-$(date -u +%s)-$$"
  fi
  SESSION_ID_SOURCE="generated"
fi

# ---- Ensure trace dir + permissions ----
TRACE_DIR="${HOME}/.ae/traces"
ARCHIVE_DIR="${TRACE_DIR}/archive"
if ! mkdir -p "$ARCHIVE_DIR" 2>/dev/null; then
  echo "[trace] skip: cannot mkdir $ARCHIVE_DIR" >&2
  exit 0
fi
chmod 0700 "$TRACE_DIR" 2>/dev/null || true
chmod 0700 "$ARCHIVE_DIR" 2>/dev/null || true

TRACE_FILE="${TRACE_DIR}/${SESSION_ID_SAFE}.ndjson"
LOCK_DIR="${TRACE_FILE}.lockdir"

# ---- mkdir-as-lock atomic critical section (POSIX portable, replaces flock) ----
attempt=0
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 50 ]; then
    echo "[trace] skip: lock timeout after 50 attempts on $LOCK_DIR" >&2
    exit 0
  fi
  sleep 0.1
done
# Single-quoted trap body (defense in depth per security-reviewer P3):
# $LOCK_DIR expands at trap-fire time, not trap-set time.
# shellcheck disable=SC2016
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT INT TERM

# ---- Header line if file new ----
if [ ! -f "$TRACE_FILE" ]; then
  echo "# schema_version: 1.2" > "$TRACE_FILE"
  chmod 0600 "$TRACE_FILE" 2>/dev/null || true
fi

# ---- Verify jq available ----
if ! command -v jq >/dev/null 2>&1; then
  echo "[trace] skip: jq not installed (required for safe JSON assembly)" >&2
  rmdir "$LOCK_DIR" 2>/dev/null
  trap - EXIT INT TERM
  exit 0
fi

# ---- Assemble 9-field JSON record via jq (no shell concat per security advisory) ----
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if ! jq -nc \
    --arg ts "$NOW" \
    --arg project_root "$PROJECT_ROOT" \
    --arg skill "$AE_TRACE_SKILL" \
    --arg feature_id "$AE_TRACE_FEATURE_ID" \
    --arg outcome "$AE_TRACE_OUTCOME" \
    --arg session_id_source "$SESSION_ID_SOURCE" \
    --slurpfile families "$AE_TRACE_FAMILIES_FILE" \
    --slurpfile verdicts "$AE_TRACE_VERDICTS_FILE" \
    --rawfile diff_paths "$AE_TRACE_DIFF_PATHS_FILE" \
    '{
      timestamp: $ts,
      project_root: $project_root,
      skill: $skill,
      feature_id: (if $feature_id == "" then null else $feature_id end),
      diff_paths: ($diff_paths | split("\n") | map(select(length > 0)) | map(select(startswith("../") | not))),
      families_invoked: $families[0],
      verdicts: $verdicts[0],
      outcome: $outcome,
      session_id_source: $session_id_source
    }' >> "$TRACE_FILE"; then
  echo "[trace] warn: jq assembly failed; record skipped" >&2
fi

# ---- Cleanup lock ----
rmdir "$LOCK_DIR" 2>/dev/null
trap - EXIT INT TERM
exit 0
