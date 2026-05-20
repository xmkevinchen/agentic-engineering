---
test_id: trace-write-validate
layer: 1
plan: ".ae/plans/054-t1-trace-ndjson-instrument.md"
step: 5
---

# Test: T1 trace write-then-validate end-to-end (Layer 1)

## Context

Plan 054 Step 5 Layer 1 fixture: validate write-trace.sh produces schema-v1.2 valid records that validate-trace.sh accepts. Tests AC2 (9-field emit) + AC3 (project_root) + AC4 (degraded call via families_invoked[].state) + AC7 (Layer 1 PASS) end-to-end.

## Prompt

Run the following shell sequence (assume cwd = agentic-engineering repo root):

```bash
# Setup mock inputs
FAMS=$(mktemp -t ae-trace-fams.XXXXXX.json)
VERDS=$(mktemp -t ae-trace-verds.XXXXXX.json)
DIFFS=$(mktemp -t ae-trace-diffs.XXXXXX.txt)

echo '[{"family":"codex","state":"full"},{"family":"gemini","state":"quota_exhausted"}]' > "$FAMS"
echo '{"codex":"approved","gemini":"unavailable","tl":"approved"}' > "$VERDS"
printf 'plugins/ae/scripts/write-trace.sh\nplugins/ae/scripts/validate-trace.sh\n' > "$DIFFS"

# Emit 1 trace record
AE_TRACE_SKILL=ae:test \
AE_TRACE_FEATURE_ID=F-999 \
AE_TRACE_OUTCOME=pass \
AE_TRACE_FAMILIES_FILE="$FAMS" \
AE_TRACE_VERDICTS_FILE="$VERDS" \
AE_TRACE_DIFF_PATHS_FILE="$DIFFS" \
AE_SESSION_ID=test-uuid-trace-write-validate \
bash plugins/ae/scripts/write-trace.sh

# Validate emitted record
bash plugins/ae/scripts/validate-trace.sh ~/.ae/traces/test-uuid-trace-write-validate.ndjson

# Inspect
cat ~/.ae/traces/test-uuid-trace-write-validate.ndjson

# Verify specific assertions
echo "---ASSERTIONS---"
# Field count
jq 'keys | length' ~/.ae/traces/test-uuid-trace-write-validate.ndjson | tail -1
# project_root present and absolute path
jq -r '.project_root' ~/.ae/traces/test-uuid-trace-write-validate.ndjson | tail -1
# session_id_source = explicit (AE_SESSION_ID was set)
jq -r '.session_id_source' ~/.ae/traces/test-uuid-trace-write-validate.ndjson | tail -1
# degraded family present
jq '.families_invoked | map(select(.state != "full")) | length' ~/.ae/traces/test-uuid-trace-write-validate.ndjson | tail -1
# Permissions
stat -f "%Lp" ~/.ae/traces/test-uuid-trace-write-validate.ndjson 2>/dev/null || stat -c "%a" ~/.ae/traces/test-uuid-trace-write-validate.ndjson
stat -f "%Lp" ~/.ae/traces 2>/dev/null || stat -c "%a" ~/.ae/traces

# Cleanup
rm -f "$FAMS" "$VERDS" "$DIFFS" ~/.ae/traces/test-uuid-trace-write-validate.ndjson
```
