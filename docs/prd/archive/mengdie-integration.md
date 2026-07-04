> **RETIRED 2026-07-04 by F-070** — superseded by the F-069 project knowledge graph
> (frontmatter edges + layered index + locate-step). Kept for design history only.

---
title: "PRD: Mengdie Integration Across AE Pipeline"
status: draft
created: 2026-04-05
target: ae@0.8.0
---

# PRD: Mengdie Integration Across AE Pipeline

## Problem

Only `ae:analyze` integrates with Mengdie MCP (Step 3.5 `memory_search`). The rest of the pipeline — discuss, plan, work, review, retrospect — neither reads from nor writes to the knowledge base. This means:

1. **Decisions made in `/ae:discuss` are not persisted** as searchable knowledge — they only exist in markdown files that future conversations can't find without knowing the path.
2. **Plans don't benefit from prior art** — `/ae:plan` doesn't check if similar work was done before.
3. **Review findings are lost** — `/ae:review` catches issues but doesn't record patterns for future prevention.
4. **Retrospective insights don't feed forward** — `/ae:retrospect` generates trends but they're not queryable in future sessions.
5. **Cross-project learning doesn't happen** — knowledge stays siloed per discussion directory.

## Goal

Every pipeline stage that produces durable knowledge should **write** to Mengdie. Every stage that benefits from prior context should **read** from it. The integration must be graceful: if Mengdie MCP is unavailable, skills continue unchanged (same pattern as `ae:analyze` Step 3.5).

## Integration Map

| Skill | Read (`memory_search`) | Write (`memory_ingest`) | What to read | What to write |
|-------|:---:|:---:|---|---|
| `ae:analyze` | **has** | **add** | Prior analyses on topic | Analysis conclusions + key findings |
| `ae:discuss` | **add** | **add** | Prior decisions on topic | Each resolved decision (decisional) |
| `ae:plan` | **add** | **add** | Prior plans for similar work; known pitfalls | Plan key decisions + acceptance criteria |
| `ae:work` | -- | -- | *(no read needed — plan is the input)* | *(no write — code is the artifact)* |
| `ae:review` | **add** | **add** | Known issue patterns for this area | Review findings that are reusable (experiential) |
| `ae:retrospect` | **add** | **add** | Prior retrospective insights | Trends + actionable insights |
| `ae:code-review` | -- | -- | *(lightweight, no integration needed)* | -- |
| `ae:think` | **add** | -- | Prior reasoning on topic | *(output is ephemeral reasoning)* |
| `ae:trace` | -- | -- | *(code-level, no knowledge needed)* | -- |

## Specification

### Read Integration (memory_search)

Add a **Prior Context** step to each skill that reads, using the same pattern as `ae:analyze` Step 3.5:

```
### N.5. Prior Context (from Mengdie)

1. Call `memory_search` MCP tool with the topic/feature as query
2. If unavailable, fails, or no results → emit "Prior context: unavailable" and continue
3. If results have `degraded` field → annotate as "(partial — [reason])"
4. Present under "## Prior Art from Project Knowledge Base" with provenance
5. Treat as background context — does not constrain current work
```

**Placement per skill:**
- `ae:discuss` — after loading discussion context, before generating topic analysis
- `ae:plan` — after loading discussion/analysis, before architect designs steps
- `ae:review` — before review agents start, as context for what to watch for
- `ae:retrospect` — before analysis, to compare with prior retrospective findings
- `ae:think` — at start, as background context for reasoning

### Write Integration (memory_ingest)

Add a **Knowledge Capture** step at the end of each skill that writes, after the main output is generated:

```
### N+1. Knowledge Capture (to Mengdie)

1. If `memory_ingest` MCP tool is not available → skip silently
2. Extract durable knowledge from the output (see extraction rules below)
3. Call `memory_ingest` for each knowledge item
4. Log ingested entry IDs in skill output footer
```

**Extraction rules per skill:**

| Skill | What to extract | `source_type` | `knowledge_type` | `entities` |
|-------|----------------|---------------|-------------------|------------|
| `ae:analyze` | Summary + key findings (2-3 items max) | `conclusion` | `factual` | topic tags |
| `ae:discuss` | Each **resolved** decision (not open questions) | `conclusion` | `decisional` | topic + decision tags |
| `ae:plan` | Plan rationale + key technical decisions | `plan` | `decisional` | feature + tech tags |
| `ae:review` | Reusable findings (patterns, not one-off bugs) | `review` | `experiential` | module + pattern tags |
| `ae:retrospect` | Actionable insights + trend conclusions | `retrospect` | `experiential` | pipeline + trend tags |

**Extraction constraints:**
- Max 3 items per skill invocation (avoid noise)
- Each item must be self-contained (readable without the full document)
- `source_file` = path to the generated document if available, omit if not (field is optional; dedup uses content hash)
- Title format: `[skill]: [concise finding]` (e.g., `analyze: Claude Code ink renderer is a fork of vadimdemedes/ink`)

**Extraction guidance for AI agents:**

Each ingested item should be one atomic knowledge unit — not a section copy-paste. Examples:

| Good (atomic, self-contained) | Bad (dump) |
|------|-----|
| `analyze: ink renderer is a fork of vadimdemedes/ink, customized for Claude Code's terminal output` | Copy-paste of the entire "Findings" section |
| `discuss: decided JWT with RS256 over HS256 because auth service needs asymmetric verification` | `We discussed auth and decided on JWT` (missing rationale) |
| `review: API timeout tests should cover both connect and read timeouts separately` | The full review.md P2 findings list |

Extraction heuristic per skill:
- `ae:analyze`: one item per key finding in the "Findings" section; skip findings that are just restatements of prior art
- `ae:discuss`: one item per resolved decision in the Decision Summary table; include the rationale column
- `ae:plan`: one item for the overall approach rationale; additional items only for non-obvious technical choices
- `ae:review`: one item per reusable pattern (P2+ findings that apply beyond this specific code); skip one-off bugs
- `ae:retrospect`: one item per actionable trend conclusion; skip raw statistics

### Conflict Handling

`memory_ingest` returns a `conflicts` array. When non-empty:
1. Log conflicts in skill output footer: `"⚠ Conflicts detected with: [entry IDs]"`
2. Do NOT auto-invalidate — let the user decide via future `/ae:retrospect` or manual review

### Graceful Degradation

All integration points must follow the existing `ae:analyze` pattern:
- Check tool availability before calling
- On failure → log warning, continue unchanged
- Never block skill execution on Mengdie availability

## Prerequisites (Mengdie-side)

Before AE integration can proceed, Mengdie needs these changes (tracked in `mengdie/docs/discussions/004-mvp-assessment/`):

1. **Content hash dedup** — replace `UNIQUE(project_id, source_file)` with `UNIQUE(project_id, content_hash)`. Without this, AE skills calling `memory_ingest` with varying or missing `source_file` will create duplicates.
2. **`source_file` optional** — AE skills extract knowledge in-memory; there may not be a stable file path at ingest time.
3. **Search quality validation** — import 10+ real AE conclusions, verify top-3 relevance > 70%. If search quality is insufficient, write integration will produce noise.

## Implementation Phases

This PRD should be implemented in stages, not all at once:

### Phase A: ae:analyze read + write (validates the loop) — DONE

- Read: Step 3.5 (memory_search before synthesis)
- Write: Step 4.5 (Knowledge Capture after synthesis)
- **Gate passed**: 5 ae:analyze sessions (006-010), 4/5 surfaced prior findings, 14 memories ingested

### Phase B: ae:discuss read + write — DONE

- Read: Step 1.5 (Prior Context after setup, before team spawn)
- Write: Step 9.5 (Knowledge Capture after conclusion, before shutdown)
- Compound entity tags + conflict summary added to both skills

### Phase C: remaining skills (ae:plan, ae:review, ae:retrospect, ae:think) — DONE

- ae:think: Step 1.5 Prior Context (read-only) — ba5fe5d
- ae:plan: Step 1.5 Prior Context + Step 4.5 Knowledge Capture (gated on status:reviewed) — 22ee40c
- ae:review: Prior Context before team + Knowledge Capture after report — 7431143
- ae:retrospect: Step 0.5 Prior Context + Step 4.5 Knowledge Capture (skip in --compare mode) — 3e33a57

## Implementation Notes

- Each skill's SKILL.md needs two new steps (read + write) inserted at appropriate points
- The read/write patterns are identical across skills — consider a shared instruction block in agent-teams or a reference skill
- `pipeline.yml` should gain a `mengdie: enabled` flag (default: `true`) so users can opt out
- Test: run each modified skill with and without Mengdie MCP connected

## Success Criteria

1. `/ae:discuss` decisions are retrievable via `memory_search` in a new conversation
2. `/ae:plan` surfaces prior decisions from `/ae:discuss` as context
3. `/ae:review` patterns accumulate and inform future reviews
4. `/ae:retrospect` can compare current trends with past retrospective conclusions
5. All skills work identically when Mengdie MCP is not connected (graceful degradation)
6. No skill ingests more than 3 knowledge items per invocation

## Out of Scope

- `memory_invalidate` automation (leave for manual/retrospect use)
- Cross-project search (`scope: "global"`) — save for v2
- Real-time knowledge updates during skill execution (write only at end)
- UI for browsing Mengdie contents (separate tool concern)
- Knowledge "digestion" (summarization, chunking, structured extraction) inside Mengdie itself — extraction responsibility stays on AE skill side per extraction guidance above
