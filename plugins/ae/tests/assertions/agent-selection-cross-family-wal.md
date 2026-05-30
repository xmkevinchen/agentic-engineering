---
id: agent-selection-cross-family-wal
target: ae:agent-selection
layer: 1
source: regression
---

## Expected Behavior

### MUST
- The Proxy prompt suffix MUST instruct the proxy to run `append-cross-family-trace.sh failure` at its failure boundary (after the `unavailable:` SendMessage, before exit).
- The failure call MUST carry the join-key args as TL-inlined literals in this order: `<skill> <feature_id> <angle> <family>` followed by `[reason]` — i.e. all four join-key slots are present and filled by the spawning TL, NOT derived by the proxy from its Cast block (AC7 / Doodlestein-regret join-key insurance).
- The TL fallback logic MUST, on a NON-Claude fallback that covers the angle (step 3a), write a `append-cross-family-trace.sh covered` resolution record.
- The script call MUST use the `${CLAUDE_PLUGIN_ROOT:-}` guard AND a trailing `|| true` (graceful no-op when plugin-root is unset).
- Stderr MUST be redirected to an append log (`2>>...append-cross-family.log`), NOT to `/dev/null` (preserves the skip-message observability the script emits).

### MUST_NOT
- The TL MUST NOT write a `covered` resolution record when coverage is Claude-only (step 4) — the prose MUST state that a Claude-family fallback writes no covered record and that the unmatched `cross-family-proxy-failure` record is itself the durable degraded signal.
- The suffix MUST NOT use `2>/dev/null` (would nullify the script's stderr skip diagnostics at the call site).
