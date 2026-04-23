---
name: ae:code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[files or directory]"
user-invocable: true
effort: medium
---

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes.

## Trigger

1. **Auto** — `/ae:work` calls this before each commit
2. **Manual** — run `/ae:code-review` anytime

## Mode

- **full** (default): four parallel tracks (Claude + Codex + Gemini + Doodlestein)
- **light**: Track 1 only (Claude review, skip cross-family and Doodlestein)

Mode is set by caller (ae:work reads `work.review_mode` from pipeline.yml, or `--light`/`--full` flag). When called manually, defaults to `full`.

## Execution

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family** (full mode only): Read `cross_family` from pipeline.yml. For each enabled family, launch its proxy track in parallel. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback. In **light mode**, skip Tracks 2 and 3 entirely.

**Degraded signal**: After all tracks complete, report cross-family coverage:
- All requested tracks completed → `cross_family_complete`
- Some proxy failed but fallback succeeded → `cross_family_complete` (fallback counts)
- All cross-family failed (after fallback) → `cross_family_degraded`

### Track 1: Claude Review

Check `git diff --stat` to determine change scope. Then:

- Discover reviewer agents per agent-selection Rule 4: scan `.claude/agents/*.md`, installed plugins, `~/.claude/agents/*.md`. Also check `project_agents` in pipeline.yml for entries with `role: reviewer`. Infer role from `description` keywords per the [Agent Contract Specification](../../../docs/decisions/037-agent-contract.md).
- If project reviewers found: launch matching agents based on changed file types (project agents preferred over built-in)
- If none found: use the plugin's built-in `code-reviewer` agent

Review `git diff` + `git diff --cached`.

### Tracks 2-3: Cross-family Review (for each enabled proxy in pipeline.yml cross_family)

Launch each enabled proxy agent to review the diff with an `<assigned angle>`. TL picks angles first, assigns to available proxies. If both enabled, different angles.

### Track 4: Doodlestein Adversarial Challenge (full mode only)

**Purpose**: proactive adversarial challenge on the current diff — "what did the other tracks miss?"

Launch 1 combined Doodlestein agent (sonnet model, independent subagent — no team_name) with the current diff scope (`git diff + git diff --cached`). The agent answers 3 questions in a single pass and MUST structure its reply per the **Track 4 output contract** below:

```
Agent(subagent_type: "general-purpose", model: "sonnet",
      run_in_background: true,
      prompt: "You are a Doodlestein adversarial reviewer. Review ONLY the following diff
               (do NOT run git diff yourself, do NOT look at accumulated/feature-level changes):

               <current diff>

               Answer these 3 questions concisely (1-3 sentences each). Structure your
               SendMessage reply per the Track 4 output contract: three named fields
               (strategic, adversarial, regret) in that order. Each value is the answer
               or the literal string 'No concern.'

               Questions:
               1. STRATEGIC: What is the single smartest improvement to this change?
               2. ADVERSARIAL: What mistake, oversight, or blind spot exists in this change?
               3. REGRET: Which part of this change is most likely to be reverted or reworked?

               If the change is clean and no substantive concern exists for a question,
               say 'No concern.' Do not force issues.

               SendMessage the structured reply (3 named fields) to team-lead.")
```

**Scope binding**: the diff is passed inline in the prompt. The agent MUST NOT independently query `git diff main...HEAD` or any accumulated diff. This keeps per-commit Doodlestein focused on the current step only.

**Results**: Track 4 findings are merged into the overall Results output:
- Substantive concern → **Warning**
- Critical blind spot (security, data loss) → **Block**
- "No concern" on all 3 → no output (silent pass)

#### Track 4 output contract

Track 4's SendMessage reply MUST contain these three named fields, in this order:

```
strategic: <content or "No concern.">
adversarial: <content or "No concern.">
regret: <content or "No concern.">
```

This contract is consumed by downstream persistence (added in Step 2 of Plan 045). Field names are stable; any change is a breaking change to persistence consumers.

Status mapping (derived from the three field values):
- All three = `No concern.` → `clean`
- At least one substantive finding → `findings`
- Track 4 didn't run (light mode) → `unavailable`
- **Malformed output** (missing field, unexpected key, wrong ordering) → treat as `unavailable` — persistence consumers MUST NOT guess intent from partial output

#### Per-commit persistence (staging write)

At the END of Track 4 (after the Results merge below, before `/ae:code-review` returns), Track 4 writes its structured payload to a deterministic staging file so `/ae:work` Post-commit can rename it to `<short-sha>.md` after the commit succeeds. State flows through the filesystem — not through LLM context — so it survives context compaction between D-step and Post-commit.

**Staging path**: `<output.reviews>/per-commit/.staging-<plan-id>-step-<N>.md`

**Plan-id presence contract** (shared between `/ae:code-review` and `/ae:work` Post-commit):
- When `/ae:code-review` is invoked from `/ae:work` D-step, plan-id + step-number context is passed through. Track 4 writes at `.staging-<plan-id>-step-<N>.md`. `/ae:work` Post-commit reads from the same path.
- When `/ae:code-review` is invoked manually (no plan context), Track 4 uses fallback `<plan-id>` = `manual`, `<N>` = `<iso-8601-timestamp>`. `/ae:work` Post-commit is not running in this case — no rename, no orphan.
- The determinism works because both sides agree: if plan context exists → deterministic path; if not → manual-mode self-cleanup.

Field semantics:
- `<plan-id>` = plan frontmatter `id:` from the calling `/ae:work`'s plan
- `<N>` = current step number (1-indexed) in the plan

**Manual invocation** (no plan context):
- Write staging file with `<plan-id>` = `manual` + `<N>` = `<iso-8601-timestamp>`
- Emit to stdout the terminal marker `[AE-TRACK4-MANUAL] file=<staging-path>` (logging only; no downstream consumer)
- Delete the staging file before returning. **If deletion fails** (permission denied, file locked, etc.) → emit `[AE-TRACK4-MANUAL-WARNING] file=<staging-path> deletion_failed=<reason>` and continue. Do NOT fail `/ae:code-review` — orphaned staging files are recoverable.

**Directory**: `mkdir -p <output.reviews>/per-commit/` before write (idempotent; safe across worktrees).

**Missing `output.reviews` path** (unusual — pipeline.yml broken): skip silently with warning; do not fail `/ae:code-review`.

**Light mode**: Track 4 doesn't run at all in light mode → no staging file written → `/ae:work` Post-commit will emit `status=unavailable` marker.

**Staging file schema** (markdown with YAML frontmatter):
```
---
plan: <plan path from /ae:work context>
step: <N>
status: <clean|findings>
---
## Track 4 — Per-commit Doodlestein
**Strategic**: <content or "No concern.">
**Adversarial**: <content or "No concern.">
**Regret**: <content or "No concern.">
```

Notes on the staging variant:
- `plan`, `step`, `status` are in frontmatter. `commit` and `committed_at` are added by `/ae:work` Post-commit during rename.
- **Do NOT include `type: review` in frontmatter** — this prevents per-commit files from being misread by `dashboard` / `next` / `retrospect` consumers that scan `<output.reviews>` for `type: review`.
- `status` value is derived per the Status mapping rules above.

## Results

Output directly to terminal:

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**

## Next Steps

Based on review outcome, suggest:
- If all OK → "Code is clean. Proceed with commit"
- If has Block findings → "Fix blocking issues before commit"
- If part of `/ae:work` flow → return to work's pre-commit checks

