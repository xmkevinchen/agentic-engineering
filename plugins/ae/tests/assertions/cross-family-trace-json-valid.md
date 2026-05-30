---
test_id: cross-family-trace-json-valid
layer: 1
plan: ".ae/features/active/F-031-cross-family-failure-state-not-persisted/plan.md"
step: 5
---

# Expected Behavior — append-cross-family-trace.sh emit-then-validate

## Pass criteria

All must hold:

1. **All records valid JSON** — the validity loop prints `VALID` for every non-header line, no `INVALID:` line.
2. **Exactly 3 records** — `RECORDS=3`; the three bad-input calls (bad reason, bad kind, too-few-args) appended nothing (AC3 graceful no-op).
3. **Failure field set (AC1)** — `cross-family-proxy-failure` keys are exactly `angle_lost, family, feature_id, reason, record_type, skill, timestamp`.
4. **Covered field set (AC2)** — `cross-family-angle-covered` keys are exactly `angle, feature_id, record_type, resolution_family, skill, timestamp` — no `family`, no `reason`.
5. **Injection-safe (AC8)** — the quote-injection record round-trips: `.angle_lost` reads back as `sec"urity` (jq `--arg` escaping, not printf breakage).
6. **No `ts` key (AC8)** — `HAS_TS=false`; the emitter uses `timestamp`, not the synthesis-gate `ts` wart.
7. **No `tier` key (AC8)** — `HAS_TIER=false`; tier is consumer policy, not record data.
8. **ISO-8601 timestamps (AC8)** — the trailing count equals the record count (3): every `timestamp` matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`.

## Fail signals

Any of:
- An `INVALID:` line (a printf-style breakage or malformed record)
- `RECORDS` ≠ 3 (a bad-input call wrote a record, or a good call did not)
- Failure/covered key set differs from the expected lists (missing/extra field)
- Quote-injection assertion prints nothing or a corrupted value
- `HAS_TS=true` or `HAS_TIER=true`
- ISO-8601 count ≠ record count
