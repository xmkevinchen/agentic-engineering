# T1 Trace Schema (~/.ae/traces/) — consumer spec

> Plan 054 Step 6 output. Producer: [Trace Emission Protocol](trace-emission-protocol.md). Source: discussions 054 + 055.

## TL;DR

`~/.ae/traces/<session-id>.ndjson` — append-only, 1 record per AE skill invocation, 9 fields metadata (no LLM content). Filename = CC session id (1:1 join with `~/.claude/projects/<encoded>/<same-id>.jsonl`). 90d active, 6m archive (`archive/<YYYY-MM>.tar.zst`). Schema v1.2 (header line `# schema_version: 1.2`).

## 9 fields

| # | Field | Type | Commitment | Description |
|---|---|---|---|---|
| 1 | `timestamp` | ISO 8601 string | core-locked | UTC time when skill invocation completed |
| 2 | `project_root` | string (absolute path) | core-locked | `git rev-parse --show-toplevel` or `pwd` fallback — supports cross-project trace filter |
| 3 | `skill` | string | core-locked | AE skill name (e.g., `ae:work`, `ae:review`, `ae:discuss`) |
| 4 | `feature_id` | string \| null | core-locked | `F-NNN` if invocation bound to feature, else `null` (consumer skip semantics for non-feature trace) |
| 5 | `diff_paths` | Array\<string\> | core-locked | Relative paths (to project_root) of files changed during invocation; `../`-prefixed paths filtered out (security #4) |
| 6 | `families_invoked` | Array\<{family, state}\> | extend-friendly | family ∈ {codex, gemini, oMLX, claude}; state ∈ {full, quota_exhausted, timeout, fallback, unavailable} — array element may add sub-fields (e.g., `degradation_cause: forced\|elective`) per BL-029 v0.11.x extension |
| 7 | `verdicts` | Object\<family_or_agent → verdict_value\> | extend-friendly | Per-family or per-agent verdict (`approved` / `revise` / `unavailable` / etc.) — structure flexible per skill type |
| 8 | `outcome` | enum (string) | core-locked | One of: `pass` / `fail` / `cancelled` / `unavailable` |
| 9 | `session_id_source` | enum (string) | core-locked | `explicit` (resolved from AE_SESSION_ID / CLAUDE_CODE_SESSION_ID / CC_SESSION_ID) OR `generated` (uuidgen fallback — join key unreliable) |

## File format

```
# schema_version: 1.2
{"timestamp":"2026-05-20T21:41:05Z","project_root":"/path/to/projects/agentic-engineering","skill":"ae:test",...}
{"timestamp":"2026-05-20T21:42:12Z","project_root":"/path/to/projects/agentic-engineering","skill":"ae:work",...}
...
```

- Line 1: schema version header (parser MUST skip lines starting with `#`)
- Lines 2+: 1 NDJSON record per skill invocation (compact, no pretty-print — `jq -c` required by producer)
- File permissions: 0600 (user only read/write)
- Directory permissions: 0700 (`~/.ae/traces/` and `~/.ae/traces/archive/`)

## `families_invoked[].state` enum (full spec)

5 values. Folded `degraded_call` boolean into this enum per 055 conclusion + plan review:

| state | Meaning | flip_rate inclusion (per 054 T1 sample qualification gate b) |
|---|---|---|
| `full` | Family invoked and returned non-degraded result | ✅ counted |
| `quota_exhausted` | Codex Pro / Gemini API quota hit | ❌ excluded (degraded sample) |
| `timeout` | Proxy timed out before returning | ❌ excluded |
| `fallback` | TL chose alternative family (e.g., oMLX gemma4 instead of Gemini) | ❌ excluded (currently ambiguous — see v0.11.x `degradation_cause` extension) |
| `unavailable` | Family not enabled in pipeline.yml OR MCP unreachable | ❌ excluded |

Enum is `extend-friendly` — future states (`rate_limited`, `permission_denied`, etc.) may be added without breaking readers that gracefully treat unknown enum values as "non-full → excluded from flip_rate".

## Schema version history

| Version | Date | Change | Source |
|---|---|---|---|
| 1.0 | 2026-05-20 | Initial — 8 fields, `.ae/traces/` (project-relative), filename = `<YYYY-MM-DD>.ndjson` | 055 conclusion (pre-user-reframe) |
| 1.1 | 2026-05-20 | Path → `~/.ae/traces/` (user-global), filename = `<session-id>.ndjson`, removed `session_id` field (filename is canonical), added `project_root` field | User reframe post-055 conclusion |
| 1.2 | 2026-05-20 | Added `session_id_source` field (enum: explicit / generated) — codex Q3 plan review finding: explicit AE_SESSION_ID adapter chain may fallback to uuidgen, consumer needs to know join key reliability | Plan 054 review (codex-proxy) |

## Filename + join key

**Canonical**: filename of `~/.ae/traces/<session-id>.ndjson` = CC session id, enabling 1:1 join with `~/.claude/projects/<url-encoded-project-path>/<same-session-id>.jsonl` (CC session content).

**AE_SESSION_ID adapter chain** (priority order, producer resolution per [Trace Emission Protocol](trace-emission-protocol.md)):

1. `AE_SESSION_ID` env var (caller-set; AE-owned, highest priority)
2. `CLAUDE_CODE_SESSION_ID` env var (CC harness — verified exposed per dependency-analyst F5 plan review)
3. `CC_SESSION_ID` env var (legacy/test, lowest CC priority)
4. `uuidgen` (fallback when all above missing — sets `session_id_source: generated`)

**Filename sanitization** (security #3): `[^A-Za-z0-9_-]` chars in session id replaced with `_` to prevent path traversal. Empty after sanitize → uuidgen + `session_id_source: generated`.

## Composite key fallback (edge cases)

When filename is unavailable (e.g., cross-session aggregation, deleted files), consumers may use composite key:

```
(timestamp_start, skill, feature_id, project_root)
```

Useful for: cross-session GTD cycle-time analysis (BL-087), accumulated cross-family metrics (BL-029).

## `diff_paths` convention

- Type: `Array<string>` (always present, may be empty `[]`)
- Path relativity: **relative to `project_root`** (e.g., `plugins/ae/skills/work/SKILL.md`, not `/Users/.../plugins/...`)
- Filtering: paths starting with `../` are filtered out by producer (security #4 — defense against accidental ssh key paths in diff)
- Source: skill is responsible for capturing `git rev-parse HEAD` at invocation start, then `git diff --name-only $START_HEAD HEAD` at end → pass via `AE_TRACE_DIFF_PATHS_FILE`. Plan 054 Step 6 architect C3 advisory: write-trace.sh receives the final list, does NOT re-compute.

## Consumer contract (v0.11.x)

Consumers (BL-029 cross-family measurement / BL-087 GTD cycle-time / ae:plugin-stats regression detection) MUST honor:

1. **Header skip**: parse-skip lines starting with `#`.
2. **session_id_source filter**: only join CC session content when `session_id_source == "explicit"`. `generated` records have unreliable join key.
3. **054 T1 sample qualification gates** (for cross-family flip rate calculation specifically):
   - (a) ≥ 6 logic/behavioral features in 12-review window (judge via `diff_paths` extension classification — `.md` only in `docs/` or `.github/` = doc/CI, anywhere in `plugins/` = logic)
   - (b) exclude `families_invoked[].state != "full"` samples from flip rate numerator/denominator (track degradation_rate separately)
   - (c) **paywall context fix**: 12-review window must contain ≥ 6 reviews where BOTH `codex` AND `gemini` are present in `families_invoked` with `state: "full"` before closing window and triggering Gemini downgrade decision. Free-tier Gemini users will never close window (`degraded` samples don't count); this is **intentional** (prevents false-trigger downgrade per user paywall reframe).
4. **Unknown enum tolerance**: future `families_invoked[].state` values + `verdicts` keys MUST be tolerated (treat unknown as "non-`full` → excluded" for state, "non-`approved` → unknown verdict" for verdicts).
5. **Stable filename = session id**: consumers MAY use filename for join; if file moved to `archive/`, extract first.

## Deferred to v0.11.x (NOT in current schema)

These were considered in plan review (Consider items) but deferred to consumer-stage BLs:

- `emission_skipped_total` counter (gemini reliability #3) — write-trace.sh stderr warnings not currently captured as metrics
- Self-trace on emission failure (gemini reliability #4) — failed emissions not currently re-traced
- GDPR retention review (gemini reliability #5) — current 90d active + 6m archive is engineering default, not legal-reviewed
- `plugin.json requires.cc_version` advisory (codex Q4) — version pinning to CC plugin API not declared

## Cross-references

- [Trace Emission Protocol](trace-emission-protocol.md) — producer wiring (called from 7 SKILL.md `## Trace emission (final step)` sections)
- `plugins/ae/scripts/write-trace.sh` — producer script
- `plugins/ae/scripts/trace-rotate.sh` — lifecycle script
- `plugins/ae/scripts/validate-trace.sh` — schema validator
- 054 conclusion `.ae/discussions/054-ae-harness-engineering-roadmap/conclusion.md` (T1 row)
- 055 conclusion `.ae/discussions/055-t1-trace-specification/conclusion.md`
- Plan 054 `.ae/plans/054-t1-trace-ndjson-instrument.md`
