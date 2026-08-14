# T1 Trace Schema (~/.ae/traces/) — consumer spec

> Plan 054 Step 6 output. Producer: [Trace Emission Protocol](trace-emission-protocol.md). Source: discussions 054 + 055.

## TL;DR

`~/.ae/traces/<session-id>.ndjson` — append-only, **multiple emitter shapes coexist in the same file**: the 9-field protocol record (1 per skill invocation, schema v1.2), the Check 6 review-invariant record (1 per `/ae:review` invocation), the synthesis-gate per-round record (N per `/ae:discuss` invocation), and the two F-031 cross-family WAL records (`cross-family-proxy-failure` + `cross-family-angle-covered`, 0..N per skill invocation). Filename = CC session id (1:1 join with `~/.claude/projects/<encoded>/<same-id>.jsonl`). 90d active, 6m archive (`archive/<YYYY-MM>.tar.zst`). The 9-field protocol record version header (`# schema_version: 1.2`) governs only the 9-field shape; sibling emitters are versioned via this doc's registry below.

## Multi-emitter contract

`~/.ae/traces/<session-id>.ndjson` is an append-only log written by multiple producers with **different record shapes**. Consumers route by record shape using the `record_type:` field; the registry below is the authoritative list of known shapes at v0.10.x.

### Emitter registry

| # | record_type | Producer | Cardinality | Full field list |
|---|---|---|---|---|
| 1 | _(absent — legacy implicit)_ | 7 SKILL.md `## Trace emission (final step)` via `write-trace.sh` | 1 per skill invocation | `timestamp`, `project_root`, `skill`, `feature_id`, `diff_paths`, `families_invoked`, `verdicts`, `outcome`, `session_id_source` |
| 2 | `review-check-6` | `plugins/ae/skills/review/SKILL.md` Check 6 (inline append) | 1 per `/ae:review` invocation (both fire-path and no-scope-path) | `record_type`, `skill`, `check`, `outcome` (`pass\|fail\|skipped_no_scope`), `files_checked` (count of changed plugin files in cumulative diff; 0 in no-scope path) |
| 3 | `synthesis-gate` | `plugins/ae/scripts/append-synthesis-trace.sh` (called from `/ae:discuss`) | N per `/ae:discuss` invocation (one per round) | `ts`, `record_type`, `skill`, `discussion_id`, `round`, `n_mechanisms`, `n_pruned`, `n_retained_with_rationale`, `n_retained_without_rationale`, `n_strictly_needed_estimate` |
| 4 | `cross-family-proxy-failure` | `plugins/ae/scripts/append-cross-family-trace.sh failure` (called by a proxy at its failure boundary; wired in `agent-selection/SKILL.md` Proxy prompt suffix) | 0..N per skill invocation (one per failed proxy angle) | `timestamp`, `record_type`, `skill`, `feature_id` (nullable), `angle_lost`, `family`, `reason` (`timeout\|connection\|rate_limit\|quota_exhausted`) |
| 5 | `cross-family-angle-covered` | `plugins/ae/scripts/append-cross-family-trace.sh covered` (called by TL after a NON-Claude fallback covers the angle; wired in `agent-selection/SKILL.md` TL fallback logic step 3a) | 0..N per skill invocation (one per covered angle; NONE when coverage is Claude-only) | `timestamp`, `record_type`, `skill`, `feature_id` (nullable), `angle`, `resolution_family` |

### Canonical discriminator rule

Consumers identify emitter via the `record_type:` field:

- **Field absent** → legacy 9-field protocol record (per-invocation; row 1 above). The absence is itself the discriminator for backward compatibility with all records emitted before F-024.
- **Field present** → route by value; treat the value as the entity key into the registry table above.

Future emitters MUST:

1. Add a `record_type:` discriminator field with an **entity-specific value** (e.g., `"review-check-6"`, `"synthesis-gate"`). Category-name values like `"check"` are forbidden — they create latent collisions when a second entity in the same category appears (the rename `"check"` → `"review-check-6"` in F-024 happened exactly because of this concern).
2. Add a row to the emitter registry table above in the **same PR** that introduces the emitter. Discipline-only at this scale; CI grep enforcement is a v0.12.x candidate.

### Known field-name asymmetries (intentional documentation of warts)

The registry deliberately captures actual field names — including divergences — rather than presenting an aspirational schema:

- **Timestamp field name differs across emitters**: the 9-field protocol record uses `timestamp` (ISO 8601). The Check 6 record currently has **no timestamp field** (consumers fall back to NDJSON line position within the session file). The synthesis-gate record uses `ts` (NOT `timestamp`). The two F-031 cross-family records (rows 4+5) use `timestamp` (ISO 8601), deliberately matching row 1 and NOT propagating the synthesis-gate `ts` wart to a new emitter. v0.11.x candidate to add `timestamp` to the Check 6 record for parity; F-024 does not address this gap (would expand scope beyond XS).
- **Record-shape size divergence** is by design: the 9-field protocol record is one-per-invocation metadata; the 5-field Check 6 record is per-gate-firing observability; the 9-field synthesis-gate record is per-round measurement. Different cardinalities and different purposes warrant different shapes — uniformity would be over-engineering.
- **Why `ts`/`timestamp` divergence is preserved, not fixed**: renaming `ts` → `timestamp` in `append-synthesis-trace.sh` would be one source-line edit, but historical synthesis-gate records already in `~/.ae/traces/<session>.ndjson` use the `ts` field name. A unilateral emitter rename would create a two-field-name situation **across time** (old records use `ts`, new records use `timestamp`) which is strictly worse for any consumer joining old + new records by timestamp than the current asymmetry **across emitters** (synthesis-gate uses `ts`, others use `timestamp`). The asymmetry is therefore intentionally preserved at v0.10.x; cross-emitter time-join is handled by consumer obligation 5.

### Consumer contract (5 obligations)

Consumers (BL-029 cross-family measurement / BL-087 GTD cycle-time / future tools) MUST honor:

1. **Header skip**: parse-skip lines starting with `#` (file may include `# schema_version:` header).
2. **Discriminator routing**: identify emitter via `record_type:` field presence and value per the canonical rule above; fall through to registry table for field expectations.
3. **Forward-compat tolerance**: tolerate unknown fields on known emitters AND unknown `record_type:` values (treat unknown record types as opaque — skip rather than error). This enables registry additions without breaking deployed consumers.
4. **Registry-update discipline**: when implementing a new emitter, update this registry table in the same PR. Out-of-band emitter additions are protocol violations.
5. **Timestamp normalization across emitters**: when joining records by time across emitters (e.g., aggregating a session timeline), normalize the timestamp field name — `ts` (synthesis-gate) and `timestamp` (9-field protocol, and rows 4+5) refer to the same logical field. Check 6 records have no timestamp today; fall back to file line position for ordering within a session.
6. **Cross-family WAL join (rows 4+5)**: to determine whether a cross-family family was silently degraded in a session, join `cross-family-proxy-failure` → `cross-family-angle-covered` on the composite key `(skill, feature_id, angle)` — note the failure record names the angle `angle_lost` and the covered record names it `angle`; normalize `failure.angle_lost == covered.angle`. A failure record **with** a matching covered record = routine fallback (angle re-covered by a non-Claude family) → NOT degraded. A failure record **without** a matching covered record = the angle was uncovered (genuine degradation), OR the TL never reached its fallback logic because it was detached/compacted — the case this WAL exists to catch. **Temporal qualifier**: an unmatched failure record is an actionable degraded verdict only relative to a *terminal* trace — a row-1 end-of-skill summary for that `skill` appears later in the file, or the session is otherwise known to have ended. An unmatched failure with no terminal marker means the run is still in flight; do not fire a degraded verdict on an in-flight gap. **Detached/compacted-TL caveat**: that case — the one the WAL most needs to catch — writes NO row-1 end-of-skill summary (the TL dies before its final-step emission), so its degradation is detected by the *second* terminal condition (the session is known to have ended: a rotated/archived session file, or a live file with no further activity past the rotation window), NOT by a row-1 marker. A consumer that keys "terminal" solely on a row-1 summary would never fire on a detached-TL degradation; the session-ended condition is the load-bearing one for BL-110's core case. Operationalizing "session known to have ended" is part of the deferred gate-consumer (BL-111).

### Cross-family degradation: tier is a consumer property (F-031)

- **Emitters are uniform.** The 9 skills that delegate to the Proxy Timeout Protocol (`analyze, review, discuss, plan, plan-review, code-review, think, trace, consensus`) emit rows 4+5 identically. There is **no per-skill tier field** on the records — "advisory vs gating" is decided by whoever *reads* the records, not by who writes them.
- **Gating-consumer set (today): `{ae:work autopass}`** (`work/SKILL.md` autopass gate reads `cross_family_degraded`). `ae:review` is an *emitter*, not a gating consumer (no `cross_family_degraded` verdict-blocking logic; BL-024 deferred true gating).
- **Fail-safe default.** Any new or unclassified consumer MUST treat an unmatched terminal failure record as degraded (block / warn), never silently continue.
- **Scope guard (F-031).** F-031 adds NO gating/blocking behavior to `ae:work` or any other skill — rows 4+5 are audit-trail appends only. Teaching a consumer to read these records and act on them is a separate, deferred feature (see the F-031 plan "Decisions not implemented").
- **Join-key fragility warning.** The failure record's join key (`skill`, `feature_id`, `angle_lost`) is inlined by the spawning TL into the `agent-selection` Proxy prompt suffix at proxy-spawn time. If a future edit removes or empties that inlining, all failure records emit empty/`null` join keys and the WAL silently becomes unjoinable — the script still exits 0 and the file still looks well-formed. Do not trim the literal arg slots from the suffix.

#### Inspecting cross-family degradation (day-1 reader)

Until an automated consumer ships, inspect a session file manually — list unmatched failure records (genuine degradations):

```sh
# DEGRADED = a cross-family-proxy-failure with no matching cross-family-angle-covered
sed '/^#/d' SESSION.ndjson \
  | jq -rc 'select(.record_type=="cross-family-proxy-failure") | [.skill,(.feature_id//""),.angle_lost,.family,.reason] | @tsv' \
  | while IFS="$(printf '\t')" read -r skill fid angle family reason; do
      covered=$(sed '/^#/d' SESSION.ndjson | jq -rc \
        --arg s "$skill" --arg f "$fid" --arg a "$angle" \
        'select(.record_type=="cross-family-angle-covered" and .skill==$s and .angle==$a and ((.feature_id // "")==$f)) | .resolution_family')
      [ -z "$covered" ] && echo "DEGRADED: $skill / $angle ($family, $reason) — no fallback coverage"
    done
```

No output = no silent degradation in that session.

### Validator scope clarification

`plugins/ae/scripts/validate-trace.sh` validates **only the 9-field protocol record** (row 1 of the registry — `record_type:` absent). Records with a `record_type:` field (rows 2, 3, 4, and 5) are out of scope at v0.10.x and will be flagged invalid by `validate-trace.sh` even though they are correctly formed per this multi-emitter contract.

**Expected false-positive count when running on a real session file**: equal to the count of sibling-emitter records in that file = (Check 6 records) + (synthesis-gate records) + (cross-family-proxy-failure records) + (cross-family-angle-covered records). For a `/ae:review`-completed session that emitted 1 Check 6 record, expect `N of M records invalid` where N = 1. For a `/ae:discuss` session with R rounds, expect N = R synthesis-gate records flagged. For a session where a cross-family proxy failed once and was re-covered, N += 2 (one failure + one covered); a detached-TL degradation adds N += 1 (failure only). This is by design and does NOT indicate corrupt traces — the validator is enforcing the protocol-record contract only, and sibling-emitter records correctly fall outside that contract. A multi-emitter validator that routes by `record_type:` is a v0.11.x candidate — see the Cross-references section.

## 9 fields

| # | Field | Type | Commitment | Description |
|---|---|---|---|---|
| 1 | `timestamp` | ISO 8601 string | core-locked | UTC time when skill invocation completed |
| 2 | `project_root` | string (absolute path) | core-locked | `git rev-parse --show-toplevel` or `pwd` fallback — supports cross-project trace filter |
| 3 | `skill` | string | core-locked | AE skill name (e.g., `ae:work`, `ae:review`, `ae:discuss`) |
| 4 | `feature_id` | string \| null | core-locked | `F-NNN` if invocation bound to feature, else `null` (consumer skip semantics for non-feature trace) |
| 5 | `diff_paths` | Array\<string\> | core-locked | Relative paths (to project_root) of files changed during invocation; `../`-prefixed paths filtered out (security #4) |
| 6 | `families_invoked` | Array\<{family, state}\> | extend-friendly | family ∈ {codex, gemini, oMLX, claude}; state ∈ {full, quota_exhausted, timeout, fallback, unavailable} — array element may add sub-fields (e.g., `degradation_cause: forced\|elective`) per BL-029 v0.11.x extension. **Optional `evidence` sub-field** ∈ {`none`, `agent_attested`, `backend_correlated`} — records how the family's participation was established. **`state` is NOT gated on it**: the two are independent, `state` keeps its existing meaning, and no consumer contract changes. See "evidence sub-field" below. |
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

### `families_invoked[].evidence` sub-field (optional)

Records **how** a family's participation was established, separately from `state`, which records **what happened**. A run can be `state: full` with `evidence: none` — that combination is not a contradiction, it is the normal case for a family with no receipt mechanism, and it is the point of adding the field.

| value | meaning |
|---|---|
| `none` | Nothing corroborates the participation beyond the orchestrator's own bookkeeping. |
| `agent_attested` | The proxy sent a receipt naming its backend call. The receipt is authored by the same agent that produced the verdict, so this is a claim, not a proof. |
| `backend_correlated` | The receipt's correlator was checked against an artifact the agent does not write (for Codex, the rollout file named by its thread id). Establishes that a call occurred on that thread — never that the verdict came from it. |

Deliberately **additive and non-gating**:

- No `state` value is conditional on `evidence`. Gating one self-reported field on another self-reported field written by the same author in the same record would establish nothing; both are emitted by the skill itself (`trace-emission-protocol.md`), with no independent producer.
- No schema version bump. Row 6 is already declared extend-friendly for exactly this, `validate-trace.sh` checks only that `families_invoked` is an array and never inspects elements, and obligation 4 of the **"Consumer contract (v0.11.x)"** list below — *Unknown enum tolerance*, not the identically-numbered *Registry-update discipline* in the multi-emitter contract further up — already requires tolerating unknown values. See also the bump-rule table in `trace-emission-protocol.md`, whose sub-field row covers this case.

**Absence is not `none`.** A record with no `evidence` key means *unreported* — the producer said nothing — which is not the same claim as `evidence: none`, where the producer looked and found no corroboration. Consumers MUST NOT collapse the two. Any future measurement over this field reports **coverage** (how many records carry it at all) separately from the `none` / `agent_attested` / `backend_correlated` breakdown; folding unreported records into `none` would credit producers that never implemented the field with a finding they never made.
- Records written before this field exists read as **`agent_attested` at best** — the field's absence is not evidence of correlation, and nothing should back-infer one. This replaces any retroactive relabelling of the existing corpus.

**What this field does not do.** It records a claim about provenance; it does not enforce one. Nothing today requires a consumer to check that a `backend_correlated` value was actually correlated (BL-127), and a `cross-family-proxy-failure` WAL record is still not written when a verdict is ruled inadmissible (BL-126). The field makes the distinction *recordable*, which is the prerequisite for measuring it later — the reason the retention question was left open rather than answered.

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
- `plugins/ae/scripts/write-trace.sh` — producer script (9-field protocol record, registry row 1)
- `plugins/ae/scripts/append-synthesis-trace.sh` — producer script (`synthesis-gate` record, registry row 3) — called from `/ae:discuss`
- `plugins/ae/skills/review/SKILL.md` Check 6 — inline producer (`review-check-6` record, registry row 2)
- `plugins/ae/scripts/trace-rotate.sh` — lifecycle script
- `plugins/ae/scripts/validate-trace.sh` — schema validator (protocol-record-only at v0.10.x; multi-emitter validation deferred to v0.11.x)
- 054 conclusion `.ae/discussions/054-ae-harness-engineering-roadmap/conclusion.md` (T1 row)
- 055 conclusion `.ae/discussions/055-t1-trace-specification/conclusion.md`
- Plan 054 `.ae/plans/054-t1-trace-ndjson-instrument.md`
