---
name: code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[<target> | files or directory]"
user-invocable: true
effort: medium
---

## Argument Inference

Resolve `$ARGUMENTS` into a target before invoking tracks. Three forms (priority order — file-existence wins over pattern match):

### Form 1 — Local file or directory path

If `$ARGUMENTS` is a path that exists in the working tree (file or directory), the diff scope is limited to that path's current working-tree state (staged + unstaged) — equivalent to `git diff -- <path>` + `git diff --cached -- <path>`. Wins over Form 2 even if string also matches commit SHA pattern (avoids hex-filename collision).

### Form 2 — Commit reference / range

If `$ARGUMENTS` matches:
- Contains `..` → commit range (e.g., `HEAD~3..HEAD`, `main..HEAD`, `<sha>..<sha>`)
- `^[a-f0-9]{7,40}$` → single commit SHA → diff is `<sha>~1..<sha>`
- `^HEAD~?[0-9]*$` → relative commit reference → single-commit interpretation

Treat as commit-range review target. Diff scope is `git diff <range>` (no `--cached`).

### Form 3 — Empty (existing pre-commit behavior)

`$ARGUMENTS` empty → existing behavior: review current uncommitted diff = `git diff` + `git diff --cached`. This is the default ae:work D-step path.

### TL execution discipline (substitution marker)

The Track 1 + Track 4 spawn prompts use the placeholder `{{ TARGET_DIFF_OUTPUT }}` for the inline diff text (Track 4) and reference `{{ TARGET_DIFF_CMD }}` only as a **display label** in audit logs. TL MUST replace `{{ TARGET_DIFF_OUTPUT }}` with captured stdout BEFORE spawning agents.

**Diff capture — argv-array execution (NOT shell string eval)**:

| Form | argv arrays to execute | Note |
|---|---|---|
| 1 (file/dir path `<P>`) | `[["git","diff","--",P], ["git","diff","--cached","--",P]]` | both staged and unstaged for that path; concat outputs |
| 2 commit range `<R>` | `[["git","diff",R]]` | no `--cached`; `R` is the resolved range string |
| 2 single SHA `<S>` | `[["git","diff",f"{S}~1..{S}"]]` | TL resolves to range form first |
| 3 empty | `[["git","diff"], ["git","diff","--cached"]]` | existing behavior; concat outputs |

**Why argv arrays (not shell string substitution)**: passing `<P>` / `<R>` directly into a shell string template (e.g., `eval "git diff -- $P"`) is shell injection territory — a path with `;`, backticks, or `$(...)` would execute arbitrary code. argv arrays bypass shell parsing entirely; each element is a literal argument. This is defense-in-depth against malformed paths or hostile `$ARGUMENTS`.

**Bash invocation pattern** (TL): use `git diff -- <P>` form with positional args via the Bash tool — pass each argv element as a separate token. Do NOT construct a shell string from the table by interpolation.

Display-label `{{ TARGET_DIFF_CMD }}` in observability trace (line below) is the human-readable rendering of the argv array (e.g., `git diff -- src/foo.py`) — for log readability only, NEVER fed back into shell.

**Observability trace** (single-line, after argv resolution, before Track 1 spawn):
```
[AE-CODE-REVIEW] Argument inference: target=<target>, form=<1|2|3>, diff_argv=<JSON-array>
```

If trace absent in audit log → TL skipped resolution. This makes the failure mode visible.

**MUST not leave raw `{{ TARGET_DIFF_OUTPUT }}` token in spawned prompts** — agents reading the literal token would treat it as quoted string and fail silently. Substitution is mandatory at spawn time.

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes (default) or a specified target (Forms 1-2 above).

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:code-review creates exactly **5 tasks** per invocation (1 Pre-check + 4 review tracks). NO additional per-finding / per-fixup task — those are sub-actions of the review.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:code-review: Pre-check` | At skill start (before any check) | Immediately at skill start | After mode/argument routing settles (control reaches "Execution") |
| `ae:code-review: Track 1 (Claude)` | At skill start (batch) | When Track 1 begins | When Track 1 findings synthesized at TL |
| `ae:code-review: Track 2 (Codex)` | (same) | When Codex proxy spawned | When Codex findings arrive at TL via SendMessage |
| `ae:code-review: Track 3 (Gemini)` | (same) | When Gemini proxy spawned | When Gemini findings arrive at TL via SendMessage |
| `ae:code-review: Track 4 (Doodlestein)` | (same) | When Doodlestein general-purpose agent spawned | When Doodlestein findings arrive at TL |

At skill start (before any track execution), batch-create:

```
TaskCreate(subject: "ae:code-review: Pre-check")
TaskCreate(subject: "ae:code-review: Track 1 (Claude)")
TaskCreate(subject: "ae:code-review: Track 2 (Codex)")
TaskCreate(subject: "ae:code-review: Track 3 (Gemini)")
TaskCreate(subject: "ae:code-review: Track 4 (Doodlestein)")
```

In light mode (cross-family disabled): Tracks 2/3/4 transition `pending → completed` directly (no `in_progress`, no work done — skipped by mode).

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:code-review: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After the Pre-check completion criterion fires (per the table above), call `TaskUpdate(taskId, status: "completed")`.
The same lifecycle applies to each track task — `TaskUpdate(taskId, status: "in_progress")` when the track's agent is spawned, `TaskUpdate(taskId, status: "completed")` when that track's findings arrive at TL. (Track-specific completion criterion = findings-arrival at TL; more precise than the generic "phase begins / completion criterion is met" wording used in the other 5 skills with this section, because each track's completion is a discrete agent-message-arrival event, not a step boundary.)

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

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

Check `git diff --stat` (or target-scoped equivalent if `$ARGUMENTS` non-empty) to determine change scope. Then:

- Discover reviewer agents per agent-selection Rule 4: scan `.claude/agents/*.md`, installed plugins, `~/.claude/agents/*.md`. Also check `project_agents` in pipeline.yml for entries with `role: reviewer`. Infer role from `description` keywords per the [Agent Contract Specification](../../../docs/decisions/037-agent-contract.md).
- **Specialist match first** by changed file domain:
  - auth / crypto / entitlements / secrets → `security-reviewer`
  - hot paths / DB queries / N+1 patterns / large allocations → `performance-reviewer`
  - module boundaries / dependency direction / API contracts → `architecture-reviewer`
  - `project_agents` specialists (per `role: reviewer` + `tech_stack` match) override built-in specialists
- **Code-reviewer as generic fallback** when no domain specialist matches changed files (e.g., README typo, config bump, generic refactor) — per F-016 Step 6 reposition. Never invoke code-reviewer when a specialist's domain is matched; surface the handoff instead.

Review the diff produced by `{{ TARGET_DIFF_CMD }}` (resolved per Argument Inference table above). Default (Form 3) = `git diff` + `git diff --cached`.

### Tracks 2-3: Cross-family Review (for each enabled proxy in pipeline.yml cross_family)

Launch each enabled proxy agent to review the diff with an `<assigned angle>`. TL picks angles first, assigns to available proxies. If both enabled, different angles.

### Track 4: Doodlestein Adversarial Challenge (full mode only)

**Purpose**: proactive adversarial challenge on the current diff — "what did the other tracks miss?"

Launch 1 combined Doodlestein agent (sonnet model, independent subagent — no team_name) with the resolved target diff scope (per Argument Inference; default Form 3 = `git diff + git diff --cached`). The agent answers 3 questions in a single pass and MUST structure its reply per the **Track 4 output contract** below:

```
Agent(subagent_type: "general-purpose", model: "sonnet",
      run_in_background: true,
      prompt: "📋 Cast: general-purpose (Track 4 Doodlestein)
                  Role: per-commit Doodlestein reviewer (combined strategic + adversarial + regret)
                  Angle: proactive adversarial challenge on current diff
                  Why: catch what Tracks 1-3 missed before commit lands

               You are a Doodlestein adversarial reviewer. Review ONLY the following diff
               (do NOT run git diff yourself, do NOT look at accumulated/feature-level changes):

               {{ TARGET_DIFF_OUTPUT }}

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

**Substitution discipline**: TL replaces `{{ TARGET_DIFF_OUTPUT }}` with captured stdout of the resolved diff argv arrays (per substitution table above) BEFORE spawning the Agent. The literal token must NOT appear in the spawned prompt — agent would treat it as quoted string and fail silently. Capture via Bash with argv-form invocations (NOT shell string eval — see "argv-array execution" rationale above): run each argv array via the Bash tool as separate token list, concatenate stdout, then substitute inline.

**Scope binding**: the diff is passed inline in the prompt. The agent MUST NOT independently query `git diff main...HEAD` or any accumulated diff. This keeps per-commit Doodlestein focused on the current step only (or the explicit target if Form 1/2).

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

**Acceptance grammar** (what counts as compliant output): the reply MUST match this regex when parsed line-by-line:

```
^strategic:\s+.+$
^adversarial:\s+.+$
^regret:\s+.+$
```

Three lines, in this exact order. Each field name is lowercase followed by `:` and at least one whitespace + non-empty content. Blank lines between fields are NOT permitted. Prose before the first field or after the third field is permitted but ignored by consumers. Any deviation (missing field, wrong ordering, extra key, empty value) is **malformed** — the reply fails the contract regardless of how "close" the prose is.

Status mapping (derived from the three field values):
- All three = `No concern.` → `clean`
- At least one substantive finding → `findings`
- Track 4 didn't run (light mode) → `unavailable`
- **Malformed output** (violates acceptance grammar above) → treat as `unavailable` — persistence consumers MUST NOT guess intent from partial output

#### Per-commit persistence (staging write)

At the END of Track 4 (after the Results merge below, before `/ae:code-review` returns), Track 4 writes its structured payload to a deterministic staging file so `/ae:work` Post-commit can rename it to `<short-sha>.md` after the commit succeeds. State flows through the filesystem — not through LLM context — so it survives context compaction between D-step and Post-commit.

**Staging path**: `<output.reviews>/per-commit/.staging-<plan-id>-step-<N>.md` (where `output.reviews` defaults to `.ae/reviews/` per pipeline.yml)

**Plan 051 path-class note**: Track 4 staging stays under `<output.reviews>/per-commit/` regardless of whether the plan being reviewed lives at `.ae/features/<state>/F-NNN-<slug>/plan.md` or under `<output.plans>/NNN.md`. The staging cache is implementation detail (per-commit, short-lived, sub-SHA addressable); user-visible review files (sibling `.ae/features/<state>/F-NNN-<slug>/review.md` for feature-dir plans, `output.reviews/NNN.md` for legacy plans — see ae:review Output write target rule) are written by `/ae:review`, not by Track 4. Both plan locations use the same staging path; the eventual `<short-sha>.md` rename is to `<output.reviews>/per-commit/<short-sha>.md` in either case.

**Plan-id presence contract** (shared between `/ae:code-review` and `/ae:work` Post-commit):
- When `/ae:code-review` is invoked from `/ae:work` D-step, plan-id + step-number context is passed through. Track 4 writes at `.staging-<plan-id>-step-<N>.md`. `/ae:work` Post-commit reads from the same path.
- When `/ae:code-review` is invoked manually (no plan context), Track 4 uses fallback `<plan-id>` = `manual`, `<N>` = `<iso-8601-timestamp>`. `/ae:work` Post-commit is not running in this case — no rename, no orphan.
- The determinism works because both sides agree: if plan context exists → deterministic path; if not → manual-mode self-cleanup.

Field semantics:
- `<plan-id>` = plan frontmatter `id:` from the calling `/ae:work`'s plan
- `<N>` = current step number (1-indexed) in the plan

**Manual invocation** (no plan context):
- Write staging file with `<plan-id>` = `manual` + `<N>` = exact filename-safe timestamp format: `YYYYMMDDTHHMMSSsssZ` (UTC, millisecond precision, no colons/dashes inside the time segment to keep the filename safe across filesystems). Example path: `.staging-manual-step-20260423T162205123Z.md`. Millisecond precision avoids collision on rapid back-to-back manual invocations.
- Emit to stdout the terminal marker `[AE-TRACK4-MANUAL] file=<staging-path>` (logging only; no downstream consumer)
- Delete the staging file before returning. **If deletion fails** (permission denied, file locked, etc.) → emit `[AE-TRACK4-MANUAL-WARNING] file=<staging-path> deletion_failed=<reason>` and continue. Do NOT fail `/ae:code-review` — orphaned staging files are recoverable.

**Stale manual-orphan TTL cleanup** (defensive): at the very start of each `/ae:code-review` invocation (before Track 4 runs), scan `<output.reviews>/per-commit/` for `.staging-manual-*.md` files older than 1 hour (mtime-based). For each match, delete and log `[AE-TRACK4-CLEANUP] removed stale manual orphan: <path>`. This prevents unbounded orphan accumulation from interrupted manual sessions without affecting recent in-progress invocations. Work-driven `.staging-<plan-id>-step-<N>.md` files are NOT touched — their lifecycle is tied to `/ae:work` Post-commit.

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

