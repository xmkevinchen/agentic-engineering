---
test_id: trace-write-validate
layer: 1
---

# Expected Behavior — T1 trace write-then-validate

## Pass criteria

All must hold:

1. **write-trace.sh exit 0** — no stderr warn about missing env/files/jq/lock/uuidgen.
2. **`~/.ae/traces/test-uuid-trace-write-validate.ndjson` created** — file exists post-write.
3. **Header line correct** — first line of file is exactly `# schema_version: 1.2`.
4. **Record count = 1** — exactly one JSON record line after the header.
5. **validate-trace.sh exit 0** — output contains `[validate] OK: 1 record(s) valid`.
6. **9 fields present** — `jq 'keys | length'` returns `9` (NOT 8 or other).
7. **project_root is absolute path** — `jq -r '.project_root'` value starts with `/` (POSIX absolute) and points to agentic-engineering repo root.
8. **session_id_source = "explicit"** — because AE_SESSION_ID was set explicitly in input.
9. **Degraded family detected** — `families_invoked | map(select(.state != "full")) | length` returns `1` (the gemini entry with `state: "quota_exhausted"`).
10. **File permissions = 0600** — `stat` output is `600` for ndjson file.
11. **Dir permissions = 0700** — `stat` output is `700` for `~/.ae/traces` directory.

## Fail signals

Any of:
- write-trace.sh stderr contains "skip:" or "warn:" (real warning, not idempotent skip)
- ndjson file missing
- Header line wrong / missing
- Record JSON malformed
- validate-trace.sh exit 1 / stderr "invalid"
- Field count ≠ 9
- project_root empty / relative / "."
- session_id_source = "generated" (means AE_SESSION_ID adapter chain didn't honor AE_SESSION_ID)
- families_invoked degraded count ≠ 1
- File perm ≠ 600 OR dir perm ≠ 700
