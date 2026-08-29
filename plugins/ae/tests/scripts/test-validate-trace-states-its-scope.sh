#!/bin/sh
# validate-trace.sh says what it validates, and what it says is what it does.
#
# The repository requires that validator to be documented as checking one record
# shape — the 9-field protocol record — and the reference doc says so. Its own
# header said the opposite: exit 0 meant all records valid, exit 1 meant any record
# invalid. A reader consults the header, not the reference, so a correctly-formed
# trace file was reported as broken.
#
# Both halves are checked here, and the second is checked by running the validator
# rather than by reading it. Two pieces of prose agreeing with each other would
# establish nothing.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
V="$REPO/plugins/ae/scripts/validate-trace.sh"

if ! command -v jq >/dev/null 2>&1; then
  echo "[skip] jq not installed; the validator cannot run"
  exit 0
fi

checked=0
failed=0
check() { # description, condition-result
  checked=$((checked + 1))
  [ "$2" = 0 ] || { echo "not ok: $1"; failed=$((failed + 1)); }
}

header=$(sed -n '1,30p' "$V")

# --- what the header claims -------------------------------------------------
echo "$header" | grep -q "record_type" && r=0 || r=1
check "the header names the field that puts a record out of scope" "$r"

echo "$header" | grep -q "9-field" && r=0 || r=1
check "the header names the shape it does validate" "$r"

# The exact sentence that was wrong. Not a paraphrase: this is the claim that told
# a reader with a valid file that the file was bad.
echo "$header" | grep -q "Exit 0 = all records valid" && r=1 || r=0
check "the header no longer claims exit 0 means every record in the file is valid" "$r"

# --- what the validator does ------------------------------------------------
tmp=$(mktemp -d "${TMPDIR:-/tmp}/ae-vt.XXXXXX")
trap 'rm -rf "$tmp"' EXIT INT TERM

record='{"timestamp":"2026-08-27T00:00:00Z","project_root":"/x","skill":"ae:work","feature_id":null,"diff_paths":[],"families_invoked":[],"verdicts":{},"outcome":"pass","session_id_source":"explicit"}'
sibling='{"timestamp":"2026-08-27T00:00:00Z","record_type":"cross-family-angle-covered","skill":"ae:review","feature_id":"F-001","angle":"a","resolution_family":"openai"}'

printf '# schema_version: 1.2\n%s\n' "$record" > "$tmp/clean.ndjson"
sh "$V" "$tmp/clean.ndjson" >/dev/null 2>&1 && r=0 || r=1
check "a file holding only the shape it validates exits 0" "$r"

printf '# schema_version: 1.2\n%s\n%s\n' "$record" "$sibling" > "$tmp/mixed.ndjson"
sh "$V" "$tmp/mixed.ndjson" >/dev/null 2>&1 && r=1 || r=0
check "a file holding a registered out-of-scope record still exits 1 — the behaviour the header now describes, unchanged" "$r"

echo "AE-SUBJECTS: $checked"
echo "$((checked - failed))/$checked claims held"
[ "$failed" -eq 0 ] || exit 1
