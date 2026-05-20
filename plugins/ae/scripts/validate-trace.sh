#!/bin/sh
# validate-trace.sh — Plan 054 Step 5: ~/.ae/traces/<session-id>.ndjson schema validator
#
# Usage: bash validate-trace.sh <path/to/file.ndjson>
# Exit 0 = all records valid; Exit 1 = any record invalid or file unreadable.
#
# Schema v1.2 (9 fields per record):
#   timestamp / project_root / skill / feature_id (nullable) /
#   diff_paths (array) / families_invoked (array of {family, state}) /
#   verdicts (object) / outcome (enum) / session_id_source (explicit | generated)

set -u

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "usage: bash validate-trace.sh <file.ndjson>" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "[validate] error: file not found: $FILE" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[validate] error: jq not installed" >&2
  exit 1
fi

# ---- Header line check ----
first_line="$(head -n1 "$FILE")"
case "$first_line" in
  "# schema_version: 1.2"|"# schema_version: 1.1"|"# schema_version: 1.0")
    : ;;  # known versions OK
  *)
    echo "[validate] error: unexpected header line: $first_line" >&2
    exit 1 ;;
esac

# ---- Per-record validation (skip lines starting with #) ----
line_num=0
invalid_count=0
record_count=0
while IFS= read -r line; do
  line_num=$((line_num + 1))
  case "$line" in
    "#"*|"") continue ;;  # skip comment + empty
  esac
  record_count=$((record_count + 1))

  # Schema check: all 9 fields present + types
  if ! printf '%s' "$line" | jq -e '
    has("timestamp") and (.timestamp | type == "string") and
    has("project_root") and (.project_root | type == "string") and
    has("skill") and (.skill | type == "string") and
    has("feature_id") and (.feature_id | type == "string" or . == null) and
    has("diff_paths") and (.diff_paths | type == "array") and
    has("families_invoked") and (.families_invoked | type == "array") and
    has("verdicts") and (.verdicts | type == "object") and
    has("outcome") and (.outcome | (. == "pass" or . == "fail" or . == "cancelled" or . == "unavailable")) and
    has("session_id_source") and (.session_id_source | (. == "explicit" or . == "generated"))
  ' >/dev/null 2>&1; then
    echo "[validate] line $line_num invalid: missing required field or wrong type" >&2
    invalid_count=$((invalid_count + 1))
  fi
done < "$FILE"

if [ "$invalid_count" -gt 0 ]; then
  echo "[validate] $invalid_count of $record_count record(s) invalid in $FILE" >&2
  exit 1
fi

echo "[validate] OK: $record_count record(s) valid in $FILE"
exit 0
