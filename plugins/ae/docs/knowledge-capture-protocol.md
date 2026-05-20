# Knowledge Capture Protocol

Shared rules for writing knowledge to Mengdie via `memory_ingest` MCP tool. Referenced by skills that produce durable knowledge (ae:analyze, ae:discuss, and future skills).

## When to Capture

Add a Knowledge Capture step at the end of each skill, after the main output is generated and written to disk.

## Extraction Rules

1. **Max 3 items per skill invocation** — avoid noise
2. **Each item must be atomic and self-contained** — readable without the full document
3. **Title format**: `[skill-name]: [concise finding]`
   - Example: `[analyze]: ink renderer is a fork of vadimdemedes/ink`
   - Example: `[discuss]: decided JWT with RS256 over HS256 for asymmetric verification`
4. **Entity tags must be specific and compound** — use `fts5-idf-contamination` not just `fts5`; use `arc-mutex-tokio` not just `concurrency`. Broad single-word tags (`auth`, `database`, `search`) cause false positive conflicts because unrelated findings share them. Each entity tag should be specific enough that two items sharing it are likely about the same narrow topic.
5. **Include rationale** — not just the decision, but why
6. **Skip restatements** — if a finding restates prior art already in Mengdie context, do not re-ingest it

## memory_ingest Call

For each extracted item, call `memory_ingest` with:

```
memory_ingest({
  title: "[skill]: [concise finding]",
  content: "[self-contained description with rationale]",
  source_file: "[path to generated document, or empty string if unavailable]",
  source_type: "[conclusion|review|plan|retrospect]",
  knowledge_type: "[decisional|experiential|factual]",
  entities: "[comma-separated entity tags]"
})
```

## Graceful Degradation

1. If `memory_ingest` MCP tool is not available → skip silently
2. Emit in output footer: `Knowledge capture: skipped (Mengdie unavailable)`
3. Never block skill execution on Mengdie availability

## Conflict Handling

If `memory_ingest` returns a non-empty `conflicts` array:
1. Log in skill output footer: `Conflicts detected with: [comma-separated entry IDs]`
2. Do NOT auto-invalidate — leave for user/retrospect to resolve
3. In the skill's closing output (Step 5 for ae:analyze, Step 10 for ae:discuss), include a conflict summary line:
   - If no conflicts: `Knowledge capture: [N] items ingested, no conflicts`
   - If conflicts: `Knowledge capture: [N] items ingested, conflicts detected with: [comma-separated titles]`

## Skill-Specific Extraction Heuristics

Each skill defines what to extract. Common patterns:

| Skill | What to extract | source_type | knowledge_type |
|-------|----------------|-------------|----------------|
| ae:analyze | Key findings from Findings section; skip prior art restatements | conclusion | factual |
| ae:discuss | Each resolved decision from Decision Summary; include rationale | conclusion | decisional |
| ae:plan | Overall approach rationale; non-obvious technical choices | plan | decisional |
| ae:review | Reusable patterns (P2+ findings that apply beyond this code) | review | experiential |
| ae:retrospect | Actionable trend conclusions; skip raw statistics | retrospect | experiential |

## Related references

- T1 trace schema spec: [trace-schema.md](references/trace-schema.md)
- T1 trace emission wiring (called from 7 SKILL.md `## Trace emission (final step)` sections): [trace-emission-protocol.md](references/trace-emission-protocol.md)
