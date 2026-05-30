# Trace Emission Protocol — canonical producer wiring

> Plan 054 Step 6 output (canonical doc per Doodlestein-strategic upgrade of dep-analyst F1 plan review finding). 7 SKILL.md files (work / review / discuss / plan / analyze / retrospect / plugin-stats) reference this protocol via 2-line pointer in their `## Trace emission (final step)` section. Schema spec: [trace-schema.md](trace-schema.md).

## TL;DR

Before AE skill exits, write 1 NDJSON record to `~/.ae/traces/<session-id>.ndjson` via `${CLAUDE_PLUGIN_ROOT}/scripts/write-trace.sh`. Pass 7 env vars + 3 temp JSON file paths. Schema v1.2 (9 fields, no LLM content).

## 5-step protocol (called by SKILL.md final step)

### 1. Aggregate state during skill execution

Throughout the skill's run, capture these values into local variables:

- `skill` — the AE skill name (`ae:work`, `ae:review`, `ae:discuss`, etc.) — usually static per SKILL.md
- `outcome` — one of `pass` / `fail` / `cancelled` / `unavailable` (skill-specific judgment at end)
- `families_invoked` — array of `{family, state}` pairs:
  - `family` ∈ `{codex, gemini, oMLX, claude}`
  - `state` ∈ `{full, quota_exhausted, timeout, fallback, unavailable}` (see [trace-schema.md `families_invoked[].state` enum](trace-schema.md#families_invokedstate-enum-full-spec))
- `verdicts` — object mapping family or agent name to verdict value
- `diff_paths` — newline-separated list from `git diff --name-only $INVOCATION_START_HEAD HEAD` (skill captures `$INVOCATION_START_HEAD` via `git rev-parse HEAD` at skill start)
- `feature_id` — `F-NNN` if invocation bound to a feature (from plan frontmatter `feature:` field or plan path resolution per `ae:agent-teams` § Milestone path resolution), else empty string

### 2. Write JSON inputs to temp files

JSON arrays/objects MUST NOT be passed via env vars (codex Q2 plan review finding + gemini reliability #1 — shell escaping fragile, ARG_MAX risk). Use `mktemp` temp files:

```sh
families_file=$(mktemp -t ae-trace-families.XXXXXX.json)
verdicts_file=$(mktemp -t ae-trace-verdicts.XXXXXX.json)
diff_paths_file=$(mktemp -t ae-trace-diffs.XXXXXX.txt)

# Write content
printf '%s\n' "$families_json" > "$families_file"     # JSON array string
printf '%s\n' "$verdicts_json" > "$verdicts_file"     # JSON object string
printf '%s\n' "$diff_paths_newline_separated" > "$diff_paths_file"
```

### 3. Set env vars per write-trace.sh contract

```sh
export AE_TRACE_SKILL="$skill"
export AE_TRACE_FEATURE_ID="$feature_id"                    # empty string OK
export AE_TRACE_OUTCOME="$outcome"
export AE_TRACE_FAMILIES_FILE="$families_file"
export AE_TRACE_VERDICTS_FILE="$verdicts_file"
export AE_TRACE_DIFF_PATHS_FILE="$diff_paths_file"
export AE_SESSION_ID="${AE_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-${CC_SESSION_ID:-}}}"
```

**AE_SESSION_ID adapter chain** (highest to lowest priority):
1. `AE_SESSION_ID` (caller may set explicitly)
2. `CLAUDE_CODE_SESSION_ID` (CC harness, verified exposed per dependency-analyst F5)
3. `CC_SESSION_ID` (legacy/test)
4. `uuidgen` fallback (write-trace.sh sets `session_id_source: generated` in record)

The chain assignment runs unconditionally in the SKILL.md emission step; write-trace.sh's own chain handles the fallback if all are empty.

### 4. Call write-trace.sh + cleanup temp files

```sh
"${CLAUDE_PLUGIN_ROOT}/scripts/write-trace.sh"
emission_status=$?
rm -f "$families_file" "$verdicts_file" "$diff_paths_file"
```

write-trace.sh is non-blocking — it returns exit 0 even when skipping (missing env, no jq, lock timeout, etc.). The script writes `[trace] skip: <reason>` to stderr on graceful skip.

### 5. Graceful: skill output footer on emission failure

If `emission_status != 0` (extremely rare — only on shell-level errors), or stderr contains `[trace] warn:` / `[trace] skip:`, write a 1-line footer to the skill's output:

```
[trace] emission skipped: <reason from stderr>
```

Do NOT abort the skill. Trace failure is non-essential to skill success — commits + plan checkbox updates are the primary artifact.

## Future schema bumps

When schema evolves (1.2 → 1.3, 1.4, etc.):

1. Update **this file** (`trace-emission-protocol.md`) with new field aggregation requirements in Step 1
2. Update [`trace-schema.md`](trace-schema.md) field table + version history
3. Bump `write-trace.sh` header line emission: `# schema_version: 1.X`
4. Bump `validate-trace.sh` accepted version case statement
5. **7 SKILL.md pointers DO NOT change** — pointer points to this doc, schema bump propagates automatically (this is the canonical-doc-pointer pattern win)

If a new field requires SKILL.md to capture additional state (e.g., new env var), the SKILL.md emission section may need a parallel update — but this is rare; most new fields can be derived inside write-trace.sh from existing inputs.

## Schema bump rule

| Change type | Pointer doc edit | SKILL.md edit | Schema version bump |
|---|:-:|:-:|:-:|
| Add `extend-friendly` field with derivable value | ✅ | ❌ | ✅ (1.X → 1.X+1) |
| Add `extend-friendly` field requiring new caller-side state | ✅ | ✅ (7 files) | ✅ |
| Change `core-locked` field semantics | ⚠️ migration plan needed | ⚠️ | ✅ (1.X → 2.0) — major bump |
| Remove field | ⚠️ migration plan needed | ⚠️ | ✅ (1.X → 2.0) |

## Cross-references

- [trace-schema.md](trace-schema.md) — consumer-facing field spec
- `plugins/ae/scripts/write-trace.sh` — receiver of emission inputs
- 7 SKILL.md files (work / review / discuss / plan / analyze / retrospect / plugin-stats) — call this protocol in `## Trace emission (final step)` section
- Plan 054 `.ae/plans/054-t1-trace-ndjson-instrument.md` Step 3 + Step 6
- **Sibling emitters (NOT this final-step protocol)** — other producers append their own record shapes to the same `~/.ae/traces/<session>.ndjson` stream; see the [trace-schema.md emitter registry](trace-schema.md) for the authoritative list. Notably `plugins/ae/scripts/append-cross-family-trace.sh` (F-031) emits `cross-family-proxy-failure` (from a proxy at its failure boundary) and `cross-family-angle-covered` (from TL fallback) — these fire mid-skill from the Proxy Timeout Protocol, not from a skill's final-step emission, so they are out of scope for this protocol doc and are versioned via the registry.
