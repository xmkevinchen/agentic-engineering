#!/bin/sh
# append-cross-family-trace.sh — F-031: cross-family paired-record WAL emitter
#
# Emits one of two sibling NDJSON record types to ~/.ae/traces/<session-id>.ndjson:
#   - cross-family-proxy-failure : written by a proxy at its failure boundary (before exit)
#   - cross-family-angle-covered : written by TL after a NON-Claude fallback covered the angle
# A `proxy-failure` record with no matching `angle-covered` (joined on skill,feature_id,angle)
# is the durable degraded signal — it survives a detached/compacted TL.
# Full design: docs/references/trace-schema.md (rows 4+5). Source: F-031.
#
# Usage:
#   append-cross-family-trace.sh failure <skill> <feature_id> <angle_lost> <family> <reason>
#   append-cross-family-trace.sh covered <skill> <feature_id> <angle> <resolution_family>
#
# reason in {timeout, connection, rate_limit, quota_exhausted} (failure only).
# feature_id may be empty -> emitted as JSON null.
#
# Modeled on write-trace.sh (NOT append-synthesis-trace.sh): jq --arg JSON assembly
# (injection-safe for string fields), session-id adapter chain WITH uuidgen fallback,
# mkdir-as-lock, schema_version header on new file. Graceful: bad args / missing jq ->
# warn to stderr, exit 0 (never breaks the calling proxy/TL).

set -u

# ---- Validation order: kind FIRST, then arg count, then reason ----
KIND="${1:-}"
case "$KIND" in
  failure)
    if [ "$#" -ne 6 ]; then
      echo "[append-cross-family-trace] skip: 'failure' expects 5 args (skill feature_id angle_lost family reason), got $(($# - 1))" >&2
      exit 0
    fi
    ;;
  covered)
    if [ "$#" -ne 5 ]; then
      echo "[append-cross-family-trace] skip: 'covered' expects 4 args (skill feature_id angle resolution_family), got $(($# - 1))" >&2
      exit 0
    fi
    ;;
  *)
    echo "[append-cross-family-trace] skip: unknown kind '$KIND' (expected 'failure' or 'covered')" >&2
    exit 0
    ;;
esac

SKILL="$2"
FEATURE_ID="$3"
ANGLE="$4"

if [ "$KIND" = "failure" ]; then
  FAMILY="$5"
  REASON="$6"
  case "$REASON" in
    timeout|connection|rate_limit|quota_exhausted) : ;;
    *)
      echo "[append-cross-family-trace] skip: invalid reason '$REASON' (expected timeout|connection|rate_limit|quota_exhausted)" >&2
      exit 0
      ;;
  esac
else
  RESOLUTION_FAMILY="$5"
fi

# ---- Session ID adapter chain (with uuidgen fallback — unlike append-synthesis-trace.sh) ----
RESOLVED_SESSION_ID="${AE_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-${CC_SESSION_ID:-}}}"
if [ -z "$RESOLVED_SESSION_ID" ]; then
  if command -v uuidgen >/dev/null 2>&1; then
    RESOLVED_SESSION_ID="$(uuidgen)"
  else
    RESOLVED_SESSION_ID="generated-$(date -u +%s)-$$"
  fi
fi

# ---- Sanitize session id for filename (path traversal defense) ----
SESSION_ID_SAFE="$(printf '%s' "$RESOLVED_SESSION_ID" | tr -c 'A-Za-z0-9_-' '_')"
if [ -z "$SESSION_ID_SAFE" ]; then
  SESSION_ID_SAFE="emergency-$(date -u +%s)-$$"
fi

# ---- Ensure trace dir ----
TRACE_DIR="${HOME}/.ae/traces"
if ! mkdir -p "$TRACE_DIR" 2>/dev/null; then
  echo "[append-cross-family-trace] skip: cannot mkdir $TRACE_DIR" >&2
  exit 0
fi
chmod 0700 "$TRACE_DIR" 2>/dev/null || true

TRACE_FILE="${TRACE_DIR}/${SESSION_ID_SAFE}.ndjson"
LOCK_DIR="${TRACE_FILE}.lockdir"

# ---- jq required for injection-safe JSON assembly ----
if ! command -v jq >/dev/null 2>&1; then
  echo "[append-cross-family-trace] skip: jq not installed (required for safe JSON assembly)" >&2
  exit 0
fi

# ---- mkdir-as-lock atomic critical section (POSIX portable) ----
attempt=0
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 50 ]; then
    echo "[append-cross-family-trace] skip: lock timeout after 50 attempts on $LOCK_DIR" >&2
    exit 0
  fi
  sleep 0.1
done
# shellcheck disable=SC2064
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT INT TERM

# ---- Header line if file new (matches write-trace.sh / validate-trace.sh known header) ----
if [ ! -f "$TRACE_FILE" ]; then
  echo "# schema_version: 1.2" > "$TRACE_FILE"
  chmod 0600 "$TRACE_FILE" 2>/dev/null || true
fi

# ---- Assemble record via jq --arg (string fields are injection-safe) ----
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "$KIND" = "failure" ]; then
  jq -nc \
    --arg timestamp "$NOW" \
    --arg skill "$SKILL" \
    --arg feature_id "$FEATURE_ID" \
    --arg angle_lost "$ANGLE" \
    --arg family "$FAMILY" \
    --arg reason "$REASON" \
    '{
      timestamp: $timestamp,
      record_type: "cross-family-proxy-failure",
      skill: $skill,
      feature_id: (if $feature_id == "" then null else $feature_id end),
      angle_lost: $angle_lost,
      family: $family,
      reason: $reason
    }' >> "$TRACE_FILE" \
    || echo "[append-cross-family-trace] warn: jq assembly failed; record skipped" >&2
else
  jq -nc \
    --arg timestamp "$NOW" \
    --arg skill "$SKILL" \
    --arg feature_id "$FEATURE_ID" \
    --arg angle "$ANGLE" \
    --arg resolution_family "$RESOLUTION_FAMILY" \
    '{
      timestamp: $timestamp,
      record_type: "cross-family-angle-covered",
      skill: $skill,
      feature_id: (if $feature_id == "" then null else $feature_id end),
      angle: $angle,
      resolution_family: $resolution_family
    }' >> "$TRACE_FILE" \
    || echo "[append-cross-family-trace] warn: jq assembly failed; record skipped" >&2
fi

# ---- Cleanup lock ----
rmdir "$LOCK_DIR" 2>/dev/null
trap - EXIT INT TERM
exit 0
