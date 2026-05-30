---
test_id: cross-family-trace-json-valid
layer: 1
plan: ".ae/features/active/F-031-cross-family-failure-state-not-persisted/plan.md"
step: 5
---

# Test: append-cross-family-trace.sh emit-then-validate (Layer 1)

## Context

F-031 Step 5 executable fixture (mirrors trace-write-validate.md). Verifies the
emitter produces valid, injection-safe NDJSON for both record kinds: AC1 (failure
shape), AC2 (covered shape), AC3 (graceful no-op on bad input), AC8 (quote-injection
escaped; no `ts`/`tier` keys; ISO-8601 `timestamp`).

## Prompt

Run the following shell sequence (assume cwd = agentic-engineering repo root):

```bash
S=plugins/ae/scripts/append-cross-family-trace.sh
export AE_SESSION_ID=test-uuid-cross-family-json
TF="$HOME/.ae/traces/${AE_SESSION_ID}.ndjson"
rm -f "$TF"; rmdir "$TF.lockdir" 2>/dev/null

# AC1: failure record
sh "$S" failure ae:code-review F-031 security codex quota_exhausted
# AC2: covered record
sh "$S" covered ae:code-review F-031 security gemini
# AC8: quote-injection in a string field
sh "$S" failure ae:code-review F-031 'sec"urity' codex quota_exhausted
# AC3: bad input must NOT append (each exits 0, prints skip to stderr)
sh "$S" failure ae:x F-031 a codex bogus_reason   # bad reason
sh "$S" wrongkind a b c                            # bad kind
sh "$S" failure ae:x F-031                         # too few args

echo "---ASSERTIONS---"
# Every non-header line is valid JSON (AC8)
sed '/^#/d' "$TF" | while IFS= read -r l; do echo "$l" | jq -e . >/dev/null 2>&1 && echo VALID || echo "INVALID:$l"; done
# Exactly 3 records appended (bad-input calls wrote nothing) (AC3)
echo "RECORDS=$(sed '/^#/d' "$TF" | wc -l | tr -d ' ')"
# Failure record field set (AC1)
sed '/^#/d' "$TF" | jq -c 'select(.record_type=="cross-family-proxy-failure") | keys' | head -1
# Covered record field set (AC2)
sed '/^#/d' "$TF" | jq -c 'select(.record_type=="cross-family-angle-covered") | keys'
# Quote-injection round-trips (AC8)
sed '/^#/d' "$TF" | jq -r 'select(.angle_lost=="sec\"urity") | .angle_lost'
# No ts / no tier on any record (AC8)
echo "HAS_TS=$(sed '/^#/d' "$TF" | jq -s 'any(.[]; has("ts"))')"
echo "HAS_TIER=$(sed '/^#/d' "$TF" | jq -s 'any(.[]; has("tier"))')"
# Every timestamp ISO-8601 (AC8)
sed '/^#/d' "$TF" | jq -r '.timestamp' | grep -cE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'

# Cleanup
rm -f "$TF"; rmdir "$TF.lockdir" 2>/dev/null
```

## Expected Behavior

### MUST
- Every non-header line prints `VALID` (no `INVALID:` line) — jq parses each appended record.
- `RECORDS=3` — only the 3 well-formed calls append; all 3 bad-input calls write nothing (AC3).
- Failure record keys = `["angle_lost","family","feature_id","reason","record_type","skill","timestamp"]` (AC1).
- Covered record keys = `["angle","feature_id","record_type","resolution_family","skill","timestamp"]` (AC2) — no `family`, no `reason`.
- The quote-injection assertion prints `sec"urity` (jq `--arg` escaped it; printf would have corrupted the JSON) (AC8).
- `HAS_TS=false` and `HAS_TIER=false` (AC8).
- The final ISO-8601 count equals the record count (3).

### MUST_NOT
- No `INVALID:` line in the validity loop.
- `RECORDS` MUST NOT exceed 3 (a bad-input call appending a record = AC3 failure).
