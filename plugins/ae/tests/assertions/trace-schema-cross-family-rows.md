---
id: trace-schema-cross-family-rows
target: trace-schema
layer: 1
source: regression
---

## Expected Behavior

### MUST
- The Emitter registry MUST contain a row for `cross-family-proxy-failure` listing fields `timestamp`, `record_type`, `skill`, `feature_id`, `angle_lost`, `family`, `reason`.
- The Emitter registry MUST contain a row for `cross-family-angle-covered` listing fields `timestamp`, `record_type`, `skill`, `feature_id`, `angle`, `resolution_family`.
- The consumer contract MUST document the join rule: match failure→covered on `(skill, feature_id, angle)` with `failure.angle_lost == covered.angle`; an unmatched (relative to a terminal trace) failure record = degraded.
- The contract MUST state that the 9 Proxy-Timeout-Protocol skills are uniform emitters (tier is a consumer property), that the only gating consumer today is `ae:work` autopass, and that F-031 adds no new gating behavior (observation-only scope guard).

### MUST_NOT
- Neither record MUST carry a `tier` field (tier is consumer policy, not record data).
- The cross-family records MUST NOT use `ts` for the timestamp field — they use `timestamp` (ISO 8601), not the synthesis-gate `ts` wart.
- `validate-trace.sh` MUST remain documented as validating only the row-1 (record_type-absent) record; the cross-family records are expected out-of-scope false-positives, NOT added to the validator.
