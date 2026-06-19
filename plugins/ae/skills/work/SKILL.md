---
name: ae:work
description: Execute plan (TDD + commit + review, pre-checks chain). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
effort: high
---

<!-- ae-output-standards-v1 -->
## AE Output Standards

All deliverables (SendMessage to TL, git-tracked docs, TL replies) MUST follow:
- Line 1: conclusion / judgment / action (one sentence)
- Phase summary: `---` + heading separator + bullets
- Documents: pyramid (top ≤ 5 lines TL;DR + supporting detail below)
- Closed loop: reader makes 90%+ judgments without opening lower layers
- Self-verify: re-read your output before sending; misaligned → fix first

Full reference: [AE Output Standards](../../output-standards.md)
<!-- /ae-output-standards-v1 -->

## Argument Inference

If `$ARGUMENTS` is empty, scan for the most recent plan with `status: reviewed` and uncompleted steps (`- [ ]`) across BOTH locations:
1. **Feature-dir plans (primary)**: `.ae/features/active/F-*/plan.md`
2. **Legacy plans (fallback)**: `output.plans/*.md` (default `.ae/plans/`, configurable via `pipeline.yml`)
3. Apply tiebreaker rules across the union of both locations.
4. Found → use that plan file path.
5. Not found → check conversation context for a plan being discussed.
6. Still nothing → ask user which plan to execute.

**Tiebreaker rule**: when multiple plans match, select the most recent plan with `status: reviewed` and uncompleted steps. Ordering across the union: feature-dir plans rank by parent dir creation date (or `created:` frontmatter); legacy plans rank by `id:` frontmatter (NNN). When both yield results, prefer the most recent absolute date. `/ae:next` uses the same rule.

**Feature ID derivation for feature-dir plans**: when the resolved plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`, the plan's feature ID is **path-derived** from the parent dir's `F-NNN`. Optional `feature: F-NNN` plan frontmatter is validated against the path-derived ID and a mismatch logs a warning (`[WARNING] Plan frontmatter feature: <X> conflicts with parent dir <Y>; using path-derived <Y>`); path always wins. Legacy plans (under `output.plans/`) have no `feature:` frontmatter and no path-derived ID.

# /ae:work — Execute Plan

Execute the plan at **$ARGUMENTS**.

## Execution Flow

```
Pre-checks → Locate step → [Agent Teams?] → TDD cycle → Pre-commit → Commit → Auto-pass gate
                                                              ↑ │
                                                              └── fix & re-review ────┘
```

## Task progress tracking

Per the convention in `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:work creates these tasks:

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:work: Pre-check` | At skill start | Before Check 1 begins | After Check 5 passes |
| `ae:work: Step N — <step title>` (one per `### Step N` in plan) | After Pre-check Check 2 reads the plan body (plan-dependent dispatch). **Title source**: extract from the plan's `### Step N: <title>` heading per the normalization order in `plugins/ae/skills/agent-teams/SKILL.md` § A (canonical: strip trailing `✅ <hash>` first, then trailing `(AC...)`, trim whitespace, empty-title fallback to no-title form, then truncate to 42 chars). Do NOT restate the algorithm here — agent-teams is the source of truth. | Before TDD cycle starts (or before direct Lead implementation if test.command empty) | After Post-commit `git rev-parse --verify HEAD` succeeds (i.e., commit landed) |

**Mid-plan resume rule**: when entering on Step N because Steps 1..N-1 are `[x]`, batch-create tasks for ALL plan steps; immediately call `TaskUpdate(taskId, status: "completed")` for already-`[x]` steps; pending steps stay default.

**No tasks for sub-actions**: do NOT create per-Pre-commit-Check task (Checks A-G are sub-actions of Step N's commit), do NOT create per-TDD-sub-cycle task (write/red/implement/green/refactor are sub-actions of Step N), do NOT create per-pre-check sub-check task (Check 1-5 are sub-actions of Pre-check).

**Owner field**: omit entirely (per agent-teams §E — self-tracking tasks are not for claim).

**On error**: if a phase exits by refusal/blocker/unhandled error/user pause before its completion criterion is satisfied, leave the task at `in_progress`. Allowed status enum: `pending | in_progress | completed | deleted` only.

## Pre-checks (all must pass)

**Task lifecycle**: at skill start (BEFORE Check 1), `TaskCreate(subject: "ae:work: Pre-check")`; immediately `TaskUpdate(taskId, status: "in_progress")`. After Check 5 passes (control reaches Execution Mode Selection), `TaskUpdate(taskId, status: "completed")`.

### Milestone path resolution (helper)

This helper resolves the milestone directory used for `step-summaries.md` and `notes.md`. It is referenced by Check 4 (deferred items), Step-Summary Context (Check 2), Defer-write (Check E disposition), Step Summary persistence (Post-commit), and Accumulated Doodlestein checkpoint (Post-commit).

- **Feature-dir plan** (plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`) → milestone dir = `.ae/features/<state>/F-NNN-<slug>/milestones/`. Files inside: `step-summaries.md`, `notes.md`. (Path-derived; no plan frontmatter required.)
- **Legacy plan** (plan path under `output.plans/`) → milestone dir = `<output.milestones>/<plan-id>/` where `plan-id` = plan frontmatter `id:`. Files inside: `step-summaries.md`, `notes.md`.

When the helper is referenced below as `<milestone-dir>` it expands per the rule above based on the resolved plan path.

### Check 1: Plan Exists & Reviewed
- Read the plan file, confirm it contains `## Acceptance Criteria` or `## AC`
- If missing → suggest `/ae:plan`, **refuse to execute**
- **Paused-feature guard (F-032 D4 — keystone)**: if the resolved plan path is under `.ae/features/paused/F-NNN-<slug>/plan.md`, print the note below and **STOP — do NOT proceed** (running a paused plan in place would leave the feature live-but-classified-paused, the "phantom state" F-032 D4 exists to prevent):
  ```
  [note] F-NNN is paused. Running its plan would implicitly resume it. To resume explicitly:
    mv .ae/features/paused/F-NNN-<slug> .ae/features/active/   # then edit index.md: status: active, remove paused:/paused_reason:
  then re-run /ae:work.
  ```
  (Empty-arg argument-inference never auto-selects a paused plan — it scans `active/` only; this guard catches an EXPLICIT paused plan path. Resume = mv to `active/` first, never run in place.)
- Read plan frontmatter `status`:
  - `status: reviewed` or `status: done` → proceed (`done` plans may have remaining unchecked steps from partial execution)
  - `status: draft` → **refuse to execute**:
    ```
    Plan is unreviewed (status: draft). Run `/ae:plan-review <plan-path>` first.
    ```
  - Any other value → **refuse to execute**:
    ```
    Unknown plan status '<value>'. Valid values: draft | reviewed | done | cancelled.
    Fix the plan frontmatter before executing.
    ```
- **Self-healing**: read plan frontmatter `discussion:` field. If non-empty:
  - Read that discussion's `index.md` → check `plan:` field
  - If `plan:` is empty or `""` → patch: set `plan: "<this-plan-path>"`, log `[HEALED] Updated discussion plan: field → <this-plan-path>`
  - If `plan:` points to a DIFFERENT plan → log `[WARNING] Discussion plan: field points to <other-plan>, not this plan. Not auto-patching (ambiguous).` Continue without patching.
  - If `plan:` already correct → no action
- Scan all pending steps (`- [ ]`): if any step lacks an "Expected files:" line → warn:
  ```
  ⚠️ Steps N, M missing "Expected files:" — these steps will hard-stop at Check B (requires manual confirmation or plan update).
  ```

### Check 2: Locate Current Step

**Step completion detection rule** (deterministic — applies to all checkbox parsing in this skill):

- A `### Step N` block is COMPLETED iff every `- [...]` checkbox inside that block (between this `### Step N` heading and the next `### Step` heading or `## ` heading, whichever comes first) is `- [x]`.
- A block is PENDING iff at least one of its checkboxes is `- [ ]`.
- The **current step** = the first PENDING block in document order.
- Edge case: a `### Step N` block with NO checkboxes at all is treated as PENDING (defensive — matches authors who wrote prose-only step descriptions; prefer adding at least one checkbox during plan write).

`- [x]` = done, `- [ ]` = pending. All steps completed → suggest `/ae:review`, **refuse to execute**.

**Fixup-mode exception (F-041)**: if all steps are `[x]` BUT the invocation prompt carries review findings to address — i.e., it contains a re-work directive such as `Review returned verdict: fail. Address these findings` (the `ae-flow-controller.sh` loop-back) or an explicit human fixup request — then do NOT refuse. Enter **fixup mode**: treat each finding as a targeted TDD micro-task (write/adjust a failing test that captures the finding → fix → green → `git commit --fixup`), then run the normal Pre-commit chain (Checks A–G) and re-verify. This is what lets the autonomous review⇄re-work loop re-engage a completed plan instead of dead-ending. Fixup mode does NOT add or reopen plan steps (the plan is done); it commits findings-driven fixes against the existing steps' files. If a finding cannot be addressed without new plan scope → STOP and report (it needs a new plan/step, not a fixup).

**Task dispatch (plan-dependent)**: After locating the current step but before reading step-summaries, batch-create per-step tasks via `TaskCreate(subject: "ae:work: Step N — <title>")` — one per `### Step N` heading in the plan body. **Title extraction** follows the canonical normalization order in `plugins/ae/skills/agent-teams/SKILL.md` § A — strip trailing `✅ <hash>` → strip trailing `(AC...)` → trim → empty-title fallback (use no-title form `ae:work: Step N`) → truncate to 42 chars. Example: `### Step 3: ae:review writes feature-dir review (AC3) ✅ 18ca947` → subject `ae:work: Step 3 — ae:review writes feature-dir review`. Empty-title example: `### Step 7:` → subject `ae:work: Step 7` (no em-dash, no title suffix — the empty-title fallback). Apply the completion-detection rule above to each block: COMPLETED blocks get immediate `TaskUpdate(taskId, status: "completed")`. PENDING blocks stay default `pending`. Track the task IDs (one per step) for later TaskUpdate calls in TDD cycle and Post-commit.

#### Step-Summary Context

Read `<milestone-dir>/step-summaries.md` (resolved per **Milestone path resolution** helper above — feature-dir plan → `.ae/features/<state>/F-NNN-<slug>/milestones/step-summaries.md`; legacy plan → `<output.milestones>/<plan-id>/step-summaries.md`) if it exists. Extract the last 3 complete step blocks (identified by `## Step N` headers), or all blocks if fewer than 3 exist. If the file doesn't exist → skip silently (no error, no warning — this is normal for step 1 or first-time execution).

TL reviews these blocks internally for planning context only — understanding what decisions were made, what was rejected, and what cross-step dependencies exist before planning the current step's execution. Do NOT inject these blocks into agent spawn prompts. Injection is handled separately by the overlap heuristic below.

#### Context Overlap Heuristic

Compare the **immediately preceding step's** `Actual files:` list (from the last block in step-summaries.md) with the **current step's** `Expected files:` line (from the plan):

- **Any shared file** → inject the immediately preceding step's summary block (1 block only, not all loaded blocks) into the **developer agent** spawn prompt as a `Prior step context:` header. QA agent does NOT receive injection (QA evaluates with fresh eyes).
- **No overlap** → fresh spawn, no injection.
- **No previous step summary** (step 1, cold start, or missing `Actual files:` field) → skip injection silently, no error.

### Check 3: Agent Teams
1. Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set
   - Not set → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo.` and proceed with Lead executing TDD cycle directly (same as "No developer agents found" path). Cross-family and parallel review disabled.
2. If set → call `ToolSearch("select:Agent")` to verify Agent tool schema includes `run_in_background` parameter:
   - Schema returned WITH `run_in_background` param → `AGENT_TEAMS_FULL = true`
   - Schema returned WITHOUT `run_in_background` → `AGENT_TEAMS_FULL = false`, degrade per tier table (same as auto-fallback)
   - No results returned (Agent already loaded as first-class tool) → `AGENT_TEAMS_FULL = true`
   - ToolSearch call fails/times out → `AGENT_TEAMS_FULL = true` (fail-open), log: `[WARNING] ToolSearch unavailable, assuming full Agent Teams support`
3. Cache `AGENT_TEAMS_FULL` for this entire ae:work invocation (all steps). Do not repeat ToolSearch per step.
4. **Ceremony preset interaction (F-013)**: Read pipeline.yml → ceremony (default: full). If ceremony in {light, minimal} → AGENT_TEAMS_FULL stays per existing env-var rule (preset does NOT disable agent_teams). Env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (global solo) wins on conflict if set; ceremony preset = per-project ceremony level, not a global agent-teams toggle. See `pipeline.template.yml` ceremony comment for canonical bundling rules.

### Check 4: Deferred Items
Read `<milestone-dir>/notes.md` (resolved per **Milestone path resolution** helper above — feature-dir plan → `.ae/features/<state>/F-NNN-<slug>/milestones/notes.md`; legacy plan → `<output.milestones>/<plan-id>/notes.md`). If file doesn't exist → skip: `✅ Deferred items: none`

Parse lines matching `DEFERRED [Step N]:` where N = current step number. If matches found, display each and require TL to write a disposition before proceeding:

- **FIXED** — finding addressed in this step's implementation. Append `Disposition: FIXED` line to the entry in notes.md.
- **STILL-DEFERRED [Step M]** — re-queue to step M. Replace `[Step N]` with `[Step M]` in the DEFERRED line only (not Reason: line). If Step M > total plan steps → must use backlog instead.
- **WAIVED: \<reason\>** — accepted as-is. Append `Disposition: WAIVED: <reason>` line to the entry in notes.md.

All dispositions MUST be written to notes.md (not just in conversation). ae:review Check 4 reads these to classify resolution.

No matches → `✅ Deferred items: none`

### Check 5: Plan's Discussion Source Valid

Read plan frontmatter `discussion:` field.

- **`discussion:` is empty** → standalone plan exemption: skip this check silently, log `[WORK] Plan is standalone (no discussion); primary context load scoped to plan only.`
- **`discussion:` is non-empty string** (treated as a directory path): verify `<discussion-dir>/conclusion.md` exists, is readable, and is non-empty (file size > 0 bytes).
  - **Exists, readable, non-empty** → pass, continue to Execution Mode Selection.
  - **Missing, unreadable, or empty (zero bytes)** → **refuse to execute**:
    ```
    Plan references discussion directory <discussion-dir> but <discussion-dir>/conclusion.md is missing/unreadable/empty.
    Either conclude the discussion (run /ae:discuss <discussion-dir>) or remove plan's 'discussion:' frontmatter field to treat this plan as standalone.
    ```
    The refusal MUST show the discussion-**directory** path (same as plan's `discussion:` field value), NOT the `conclusion.md` file path, so the suggested `/ae:discuss` fix-command is directly runnable. Empty conclusion is rejected because Layer 2 (Per-step Primary Context Load) requires the "full verbatim body" as primary input; a zero-byte file would silently erase all discussion-derived constraints despite passing a file-exists check.

**Placement rationale**: Check 5 is a blocking gate with the same cost class as Check 1 file-read but more consequential semantics (refuses execution rather than patching state). Grouping it last in the Pre-check chain keeps entry gates together and mirrors Plan 046's Pre-check item 4 placement at the tail of `/ae:plan`'s Pre-check section. Independent of Check 2-4 ordering: Check 2 parses the plan body (step checkboxes), Check 4 parses milestone notes; neither depends on the conclusion.md file that Check 5 guards.

```
Pre-checks:
✅ Plan exists: docs/plans/003-feature.md
✅ Current step: Step 3 (Steps 1-2 done)
✅ Deferred items: none
✅ Plan's discussion source valid (or: standalone plan; primary context load scoped to plan only)
```

## Execution Mode Selection

**Single-platform step** → Lead executes TDD cycle directly.

**Parallel steps** → Agent Teams:

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Before `TeamCreate`** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

```
TeamCreate(team_name: "<feature>-work")

# dev-agent: dispatcher-resolved per ae:agent-selection canonical placeholder convention; project_agents (e.g., backend-dev, ios-dev) override per role + tech_stack
Agent(subagent_type: "<per agent-selection>", name: "<dev-agent>",
      team_name: "<team>", run_in_background: true,
      prompt: "<PRIMARY CONTEXT — assembled per 'Per-step Primary Context Load' section below:
                 1. Current step spec (full ### Step N block)
                 2. Full plan AC list (entire ## Acceptance Criteria section)
                 3. Conclusion body (verbatim <discussion-dir>/conclusion.md, when plan is discussion-referenced per Check 5)
                 4. Framing body (verbatim <discussion-dir>/framing.md, load-if-exists)>

               📋 Cast: <runtime-selected>
                  Role: dev-agent (Step N executor)
                  Angle: <step-specific implementation focus>
                  Why: <project_agents tech_stack match OR built-in fallback at TL spawn-decision time>

               [If overlap heuristic triggered] Prior step context: <previous step summary block>
               Execute Step N. Strict TDD: write test → red → implement → green.
               Teammates: [other devs], qa.
               SendMessage to qa when done.")

# qa: structurally fixed role — always paired with <dev-agent> as a counterpart; hardcoded by design (NOT dispatcher-resolved)
Agent(subagent_type: "qa", name: "qa",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: qa
                  Role: checker (Step N per-step quality gate)
                  Angle: <specialized focus based on context — verify tests, build, cross-family>
                  Why: structurally fixed counterpart to dev-agent (fresh-eyes evaluation per F-019 / AE convention)

               Wait for dev, then review per checklist + cross-family — <specialized focus based on context>.
               Send findings to dev, wait for fixes, re-review.
               Pass → SendMessage to dev confirming.")
```

The dev-agent prompt MUST include all 4 primary inputs on every step (see "## Per-step Primary Context Load" below for exact content rules and fresh-per-step disk-read mandate). The QA agent deliberately receives NO primary context (fresh-eyes evaluation).

No developer agents found → Lead executes directly.

## Per-step Primary Context Load

Before each step's TDD Cycle (or direct Lead execution in single-platform mode), the step-execution prompt MUST contain as primary input the four items below. This is BL-033 Layer 2 — cumulative input propagation at the plan→work phase boundary.

**Target agent**: in Agent Teams mode, "step-execution prompt" = the developer agent's spawn prompt. The QA agent receives NO primary context load (fresh-eyes evaluation). In solo mode (no developer agents found, or Agent Teams unavailable), "step-execution prompt" = the Lead agent's own context for the TDD cycle; Lead covers both developer and QA roles with full context loaded — the fresh-eyes property of QA is structurally absent in solo mode (documented Known Limit, not a bug). Note: this load is **unconditional** (always fires when Check 5 passed), distinct from the Check 2 Context Overlap Heuristic prior-step-summary injection which is **conditional** on file overlap. The two loaders both target the developer agent's spawn prompt but run on independent triggers.

**Required primary inputs**:

1. **Current step spec**: the full text of the plan's current `### Step N: <title>` block, including all subtasks (`- [ ]` bullets), the step's "Expected files:" line, and any inline notes.
2. **Full plan AC list**: the entire `## Acceptance Criteria` section (or `## AC`) of the plan — not just the ACs referenced by the current step. Downstream steps depend on invariants the current step may need to honor.
3. **Conclusion body** (when plan is discussion-referenced — Check 5 gate confirms this): the full verbatim body of `<discussion-dir>/conclusion.md`. "Primary input" = equivalent in role to CLAUDE.md or user instructions; NOT an `@reference`, NOT a summary, NOT a "read if needed" footnote.
4. **Framing body** (optional, load-if-exists): the full body of `<discussion-dir>/framing.md` if the file exists at that path. Silently skip if absent.

**Standalone plan exemption**: if plan's `discussion:` field is empty (re-read from plan frontmatter per step — do NOT cache a boolean from Pre-check Check 5; compaction between Pre-checks and per-step execution is a small but real risk), skip items 3 and 4; load only items 1 and 2.

**Fresh per-step disk read**: items 1–4 MUST be re-read fresh from disk at each step's TDD cycle start. Do NOT rely on `conclusion.md` / `framing.md` / plan body remaining in the agent's context from a prior step. Context compaction between steps in a multi-step plan will silently drop large documents; only a fresh disk read guarantees the per-step primary-input contract. This reduces Layer 2's compounding-context cost to zero per-step marginal risk (each step starts from a clean load).

**Context size note**: Layer 1 alone (conclusion loaded once per plan in `/ae:plan`) is usually fine. Layer 2 loads the same conclusion on every step; the cost profile differs by mode:
- **Agent Teams mode**: each developer agent spawn is a fresh context, so a 20KB conclusion costs 20KB per spawn. The aggregate is a token/billing concern, not a single-context truncation concern.
- **Solo mode**: Lead's context accumulates across steps (unless compaction fires). A 10-step plan × 20KB conclusion = 200KB of conclusion-body text in one context — real truncation risk as the plan progresses.

The ~30KB-and-5-steps threshold is carried forward from Plan 046 Known Limits — documented approximation, not a measured protocol invariant. If this becomes painful, re-file as targeted BL.

## TDD Cycle

The agent begins each step's TDD cycle with the Primary Context already loaded (see "Per-step Primary Context Load" above).

**Task lifecycle (precise sequencing)**: the `in_progress` transition for the current step's task fires **as early as possible upon entering the step's execution scope**, BEFORE any context loading or agent spawn — to ensure the panel reflects step entry even if context loading takes seconds. Sequence:

1. `TaskUpdate(stepTaskId, status: "in_progress")` — UNCONDITIONAL, immediately upon entering the step's scope (before primary context load, before TDD start, before any tool call).
2. Per-step Primary Context Load (re-read conclusion.md / framing.md / plan body fresh from disk).
3. TDD cycle starts (write test → red → implement → green → refactor) OR direct Lead implementation if `test.command` is empty.
4. (TDD sub-cycles are sub-actions; do NOT create or update tasks for write/red/implement/green/refactor.)
5. The `completed` transition fires later in Post-commit (NOT here) — see Post-commit section below for the criterion.

If `test.command` is empty → skip TDD, implement directly.

If `test.command` is set:
1. **Write test** — based on step's AC
2. **Confirm red** — test fails (passes → test too loose, fix)
3. **Cross-family testgen** — Codex suggests edge cases
4. **Synthesize** — merge Claude + cross-family test ideas
5. **Implement** — minimum code to pass tests
6. **Confirm green** — all tests pass
7. **Refactor** (if needed)

Complex steps → multiple TDD rounds (one per subtask).

### Fix Loop Circuit Breaker

Track consecutive failures per test file. Same test file fails N times (default: 3, configurable via `pipeline.yml` → `work.max_fix_loops`):

```
🔴 Fix loop detected: [test file] failed [N] consecutive times.

Options:
1. Retry with a different approach
2. Skip this subtask and defer
3. Pause for human help
```

## Pre-commit Checks

### A. Diff Transparency
Run `git diff --stat` and display output.

### B. Drift Check
Read the current plan step's "Expected files:" line:
- **Has "Expected files:"** → run `git diff --name-only`, compare:
  - All files in expected list → ✅ pass
  - Files outside expected list → ⚠️ drift detected:
    ```
    ⚠️ Drift detected:
    - Expected: [files from plan]
    - Actual: [files from git diff]
    - Unexpected: [difference]

    Options:
    1. Fix: revert unexpected changes and retry
    2. Approve drift: explain why (recorded in commit message)
    3. Rollback: discard this step's changes
    ```
    If unexpected files match `pipeline.yml` → `work.security_patterns` → option 2 unavailable, must fix or get human review.
- **No "Expected files:" in plan** → drift = UNKNOWN → **hard stop**:
  ```
  🛑 No Expected files in plan step — drift = UNKNOWN. Hard stop.
     Auto-pass blocked. Options:
     1. Add Expected files to the plan step, then re-run Check B
     2. Confirm to continue (drift recorded as 'unknown' in Outcome Statistics)
     3. Rollback this step's changes
  ```

### C. Tests Green
Run `test.command` from pipeline.yml. Empty → skip with "⚠️ No test command configured".

### C.1 Lint
Run `lint.command` from pipeline.yml.
- **Empty** → soft-skip with `⚠️ No lint command configured, skipping`. This is a *plain* soft-skip (continue the chain) — NOT the UNVERIFIED gate-pause that empty `test.command` triggers in the auto-pass gate (see "No test command" at the gate). Lint is a secondary check, not a verification gate; its absence is non-blocking.
- **Exit 0** → pass, continue.
- **Non-zero exit** → record a **P2-logic finding labeled `[C.1 Lint]`** and add it to the same finding set the Check E disposition step processes (shown; human chooses fix / defer / backlog per E's vocabulary). The `[C.1 Lint]` origin label ensures the finding reliably enters Check E's disposition set even when Check D code-review produced no findings — it must not be left implicit and must not silently drop, and it is NOT emitted via a separate disposition mechanism. It does **NOT** set `no_p1 = false`, and lint is **NOT** a term in the auto-pass gate expression (see Auto-pass gate below).

**Why P2-not-P1 (brownfield-safe, F-034)**: a non-zero lint exit is a *shown-but-non-gating* P2 finding, so pre-existing lint debt never halts the auto-pass gate on day one (an unconditional P1-block would halt brownfield adoption immediately). The gating baseline/regression mechanism (record violation count, block only on regression above baseline) is deliberately deferred — see the F-034 baseline BL. **Greenfield guidance**: a project starting from zero violations should disposition any C.1/C.2 finding as **fix-now**, not defer — with no pre-existing debt to baseline against, deferring would let new debt accrue silently.

### C.2 Typecheck
Run `typecheck.command` from pipeline.yml. Semantics identical to C.1:
- **Empty** → soft-skip with `⚠️ No typecheck command configured, skipping` (plain soft-skip, non-blocking).
- **Exit 0** → pass, continue.
- **Non-zero exit** → P2-logic finding labeled `[C.2 Typecheck]` added to Check E's disposition set; non-gating; does **NOT** set `no_p1 = false`; not a term in the auto-pass gate expression.

**AE-on-AE note**: AE's own `.claude/pipeline.yml` leaves `lint.command` and `typecheck.command` empty (it is a prompt/markdown repo with no linter or type checker), so C.1/C.2 *correctly* soft-skip for AE-on-AE — this is intended behavior, not inert plumbing. The checks are live for any external project that configures the commands.

### C.5 Protocol Invariant Check
If `git diff --name-only` includes files under `plugins/ae/skills/` or `plugins/ae/agents/`:
1. Run `/ae:test-plugin --regression --layer1` targeting the changed skills/agents (Layer 1 static analysis only — do NOT execute Layer 2 during pre-commit)
2. **Layer 1 failure = P1** (blocks commit via auto-pass gate, same as other P1 findings)

If no plugin files in diff → skip with "No plugin skill/agent files changed, skipping protocol check."

### D. Code Review
Read `work.review_mode` from pipeline.yml (default: `full`). Override with `--light` or `--full` flag if passed.

**Ceremony preset interaction (F-013)**: Read pipeline.yml → ceremony (default: full). If ceremony in {light, minimal} → set work.review_mode = light if not explicitly set. Explicit `work.review_mode` wins on conflict if set. `--light` / `--full` per-invocation flag wins over both.

- **full**: Lead executes `/ae:code-review` inline with all 4 tracks (Claude + Codex + Gemini + Doodlestein)
- **light**: Lead executes `/ae:code-review` inline with Track 1 only (Claude review, skip cross-family and Doodlestein)

Read the code-review SKILL.md and follow its instructions within the current context, passing the following explicit parameters (required for Track 4 persistence — see code-review/SKILL.md's "Plan-id presence contract" section):
- `mode` = `full` or `light` (from above)
- `plan_id` = plan frontmatter `id:` (current plan)
- `step_number` = current step number (1-indexed)
- `plan_path` = path to plan file

`/ae:code-review` MUST use these values to compute the Track 4 staging path. Falling back to manual-mode is NOT permitted when invoked from `/ae:work` — the parameters are always present in this call site.

### E. Disposition
Check E dispositions **every** finding accumulated across the pre-commit chain — the Check C.1 (lint) / C.2 (typecheck) P2-logic findings labeled `[C.1 Lint]` / `[C.2 Typecheck]`, the C.5 protocol-invariant result, AND Check D code-review findings — not only code-review output. Findings raised before Check D (i.e., C.1/C.2) are carried forward into this disposition set so they cannot silently drop when Check D produced nothing. Greenfield projects (zero pre-existing violations) should disposition a C.1/C.2 finding as **fix-now** rather than defer (see C.1 rationale).
- **P1 (blocker)**: always show, fix now
- **P2 logic/security**: show, human disposition (fix / defer / backlog)
- **P2 style/naming**: auto-skip — announce in one sentence (e.g. `Skipped 2 style/naming findings (minor; fix optional).`; output-standards.md Rule B)
- **P3 (minor)**: auto-skip — included in the same one-sentence announcement
- **Defer** — MUST write structured entry to `<milestone-dir>/notes.md` (resolved per **Milestone path resolution** helper; create directory and file if needed). Format:
    ```
    DEFERRED [Step N]: <one-line finding description>
    Reason: <why deferred, what will resolve it>
    ```
    `[Step N]` = target step where this must be addressed (REQUIRED). If no target step can be identified → use backlog (`BL-NNN` in `output.backlog/unscheduled/`), not defer. This write is mandatory — defer without writing to notes.md is a protocol violation.
- Backlog → `BL-NNN-slug.md` in `output.backlog/unscheduled/` (new BLs always land unscheduled; user commits to a sprint later via `/ae:roadmap plan`)

### F. Disposition Challenge
Send P1 + P2-logic/security to cross-family for challenge.

### G. Fix & Re-review
Fix findings, re-run from Check D until clean pass.

## Commit

- One step = one commit (split if too large, each must be independent)
- After commit, update plan: `- [ ]` → `- [x]` with commit hash

## Post-commit

**Task completion**: immediately after `git rev-parse --verify HEAD` succeeds (confirming the step's commit landed), call `TaskUpdate(stepTaskId, status: "completed")` for the current step's task. This is the completion criterion per agent-teams §D — the panel reflects step completion at commit-landing, not at any earlier checkpoint.

1. **Step Summary** — persist to disk AND echo in conversation.

   Write a step-summary block to `<milestone-dir>/step-summaries.md` (resolved per **Milestone path resolution** helper — feature-dir plan → `.ae/features/<state>/F-NNN-<slug>/milestones/step-summaries.md`; legacy plan → `<output.milestones>/<plan-id>/step-summaries.md`; create directory and file if they don't exist). Append one block per completed step:

   ```
   ## Step N — <step title> (commit: <hash from git rev-parse HEAD>)
   **Decisions**: [key choices made, with rationale — 1-3 bullets]
   **Rejected**: [alternatives considered but dropped, why]
   **Cross-step deps**: [files/contracts this step created that later steps depend on]
   **Actual files**: [comma-separated list from git diff --name-only, already available from Check B]
   ```

   The `Actual files:` field copies the file list from Check B's drift detection output — no re-computation needed. This field is consumed by the context overlap heuristic (see Check 2) to determine whether to inject prior step context into agent spawn prompts.

   Also echo the summary content in conversation (replacing the previous ephemeral "Brief summary" behavior).

2. **Track 4 persistence rename** (after commit, before checkpoint)

   **Authority**: schema and path-derivation rules live in `plugins/ae/skills/code-review/SKILL.md` — that file is the single source of truth. This step only consumes those rules. Do NOT diverge from code-review's path computation; if refactoring the path schema, update code-review/SKILL.md FIRST, then this section.

   After successful commit, if `/ae:code-review` was invoked in full mode during D-step, it wrote a staging file at `<output.reviews>/per-commit/.staging-<plan-id>-step-<N>.md` per the **Per-commit persistence** section in `plugins/ae/skills/code-review/SKILL.md` (which also documents the shared plan-id presence contract). The rename logic:

   1. **Commit-validation guard**: run `git rev-parse --verify HEAD`. If it fails (commit didn't succeed, detached HEAD, or shell error — including new-repo-first-commit edge case before HEAD exists), emit `[AE-TRACK4] commit=unknown status=unavailable` and skip the rename. No file written is better than invalid file. Otherwise compute `<short-sha>` via `git rev-parse --short HEAD`.
   2. Compute staging path: `<output.reviews>/per-commit/.staging-<plan-id>-step-<N>.md` using the `plan_id` and `step_number` values passed into `/ae:code-review` at D-step (see Check D). This is the same path Track 4 wrote.
   3. **Staging file exists**:
      a. **Stale-file guard** (prior rename failed mid-prepend): read the staging file's frontmatter. If it already contains a `commit:` field, the prior Post-commit run prepended but the `mv` failed — re-prepending now would double-add the field and corrupt the frontmatter. Delete the stale staging file, emit `[AE-TRACK4] commit=<short-sha> status=unavailable`, skip rename, log warning `Stale staging file detected (prior rename failed); prior findings lost, marking unavailable`.
      b. **YAML+status validation**: parse the staging file's frontmatter. MUST have: opening `---`, closing `---`, `status:` field with value in `{clean, findings}`. Any of (missing open/close, missing `status`, duplicated `status`, `status` value outside enum) → emit `[AE-TRACK4] commit=<short-sha> status=unavailable`, skip rename, log warning `Staging file frontmatter invalid — Track 4 output non-compliant`. This check subsumes the earlier "closing ---" check.
      c. **Ensure output path**: `mkdir -p <output.reviews>/per-commit/` (defensive: handles external deletion of output dir between staging write and rename).
      d. **Capture status value** from staging file (the parsed `status:` field from 3b) into a local variable. Do this BEFORE any mutation — after `mv`, the staging path no longer exists, and re-reading from the destination risks divergence from the pre-validated staging payload. The captured value is what the terminal marker reports, and what the audit trail reflects.
      e. **Prepend `commit:` + `committed_at:`** to the staging file's existing YAML frontmatter (current UTC in exact `YYYY-MM-DDTHH:MM:SSZ` format — second precision matches git's commit timestamp idiom). Existing fields (`plan`, `step`, `status`) are preserved — the prepend only adds two new lines above them inside the frontmatter block.
      f. **Rename atomically**: `mv <staging-path> <output.reviews>/per-commit/<short-sha>.md` (POSIX mv on same filesystem is atomic).
      g. **Emit terminal marker**: `[AE-TRACK4] commit=<short-sha> status=<status captured in 3d>`.
      h. SHA collision (amend re-runs `/ae:work` on same commit): overwrite acceptable — amend = semantically same commit (see Non-goals).
   4. **Staging file absent** (light mode / code-review skipped / Track 4 failed silently / new-repo-first-commit before Track 4 wrote anything): emit `[AE-TRACK4] commit=<short-sha> status=unavailable`; no file written.
   5. **Missing `<output.reviews>` path** (pipeline.yml broken): skip silently with warning `⚠️ output.reviews path not configured; Track 4 persistence skipped`. Do not fail commit post-hoc.

   This step relies on the Track 4 output contract and staging file schema documented in `plugins/ae/skills/code-review/SKILL.md` — do not redeclare the schema here. State flows through the filesystem (staging file), not through LLM context, so it survives compaction between D-step and Post-commit.

   **Non-goals**:
   - Concurrent `/ae:work` invocations on the same plan-id + step (race on staging path). Single active `/ae:work` per plan is assumed. Engineer for this only if concurrent usage becomes an observed failure.
   - Amend-overwrite audit trail preservation. Amend re-runs `/ae:work` → latest findings overwrite prior. Losing a pre-amend finding is acceptable (see Plan 045 non-goals). If this becomes painful, re-file as targeted BL.
   - Failure-mode disambiguation within `status=unavailable` (light-mode vs timeout vs malformed are all collapsed). Audit trail is improved by this feature but full reliability verifiability is a separate concern — see BL-047.

3. **Accumulated Doodlestein Checkpoint** (before gate)

   **Skip if** `pipeline.yml → work.accumulated_doodlestein: false` OR `AGENT_TEAMS_FULL = false` (run_in_background unavailable — log: `[Doodlestein checkpoint skipped: run_in_background unavailable]`). Initialize `no_accumulated_p1 = true`.

   **Ceremony preset interaction (F-013)**: Read pipeline.yml → ceremony (default: full). If ceremony in {light, minimal} → skip accumulated Doodlestein entirely (log: `[Doodlestein checkpoint skipped: ceremony preset=<value>]`). Existing `work.accumulated_doodlestein: false` guard wins on conflict if set (skip if either condition holds).

   After commit, compute from plan file:
   - `total_steps` = count all `### Step N` headings
   - `current_step` = count all completed steps (`- [x]` checkboxes at step level)

   **Trigger condition**: `(total_steps >= 3 AND current_step == total_steps)` OR `(total_steps > 5 AND current_step == floor(total_steps/2))`

   For plans with >5 steps, checkpoint runs **twice**: at midpoint and at final step. This is intentional — midpoint catches early drift, final step catches late drift.

   When triggered:
   1. For each enabled proxy (check pipeline.yml cross_family), spawn with Doodlestein prompt on `git diff main...HEAD` (accumulated feature diff):
      ```
      Agent(subagent_type: "<proxy>", run_in_background: true,
            prompt: "📋 Cast: <proxy>
                        Role: accumulated Doodlestein reviewer (<family> angle)
                        Angle: cross-commit strategic + adversarial + regret check on accumulated diff
                        Why: midpoint/final checkpoint catches drift across multi-step plans

                     You are a Doodlestein adversarial reviewer performing an accumulated review.
                     Analyze the full feature diff (git diff main...HEAD).
                     Answer 3 questions concisely (1-3 sentences each, cite file:line evidence):
                     1. STRATEGIC: What is the single smartest improvement across all these changes?
                     2. ADVERSARIAL: What cross-commit mistake or blind spot exists?
                     3. REGRET: Which decision across these commits is most likely to be reversed?
                     If a question has no substantive concern, say 'No concern.' Do not force issues.
                     SendMessage findings to team-lead.")
      ```
   2. Collect findings. Classify: P1 (critical blind spot) / P2 (concern) / P3 (minor)
   3. Write findings to `<milestone-dir>/notes.md` (resolved per **Milestone path resolution** helper) using `CHECKPOINT:` prefix (not `DEFERRED` — avoids triggering Check 4 parsing)
   4. P1 findings set `no_accumulated_p1 = false`

   If not triggered (step count doesn't match condition) → skip silently, `no_accumulated_p1` stays `true`. (Not a Rule B announcement case: the checkpoint is promised at midpoint/final only — a non-matching step count means it is not yet due, nothing is suppressed; per-step "not due" notices would be noise.)

4. **Auto-pass gate** (default: ON) — evaluate after every step:
   ```
   gate = tests_green AND no_p1 AND no_accumulated_p1 AND deferred_resolved AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)
   ```
   `no_accumulated_p1` defaults to `true`. Set to `false` only when accumulated checkpoint runs and finds P1.
   `deferred_resolved` defaults to `true`. Set to `false` when Check 4 found DEFERRED items matching current step but TL did not write dispositions for all of them.
   - All met → auto-continue: `✅ Ready to continue: tests pass, no blockers, no unresolved drift. Continuing to Step N+1.` (user-facing line is plain language — the gate's internal variables above are spec, not display; output-standards.md Rule A)
   - Any failed → **pause for user confirmation** — lead the pause message with the blocker list in plain language, codes in parentheses (e.g. `Pausing: 1 blocker finding (P1) needs a fix before continuing.`)
   - Drift detected (not approved) → always pause
   - Security pattern matched → always pause
   - No test command → `tests_green` = UNVERIFIED. **Branch on the current step's AC `verify_by` values (F-041 harness contract)**:
     - Any AC with deterministic `verify_by` (`unit`/`integration`/`e2e`) → **prompt-level hard-block**: pause, AND record the unverified deterministic AC so `/ae:review` backstops it. (A deterministic AC with no `test.command` is genuinely unverifiable. This is *layered work+review prompt enforcement*, NOT a mechanical guarantee — a SKILL.md instruction can't compile-block.)
     - All of the step's ACs are `judge`/`manual` → **check-only**: an empty `test.command` is expected (no deterministic claim to run); continue without the UNVERIFIED pause, leaving `judge` ACs to review-stage rubric-confirmation.
     - (do not treat UNVERIFIED as true)
   - No "Expected files:" in plan step → `drift` = UNKNOWN — **pause for user confirmation** (do not skip)
   - `cross_family_degraded` = true (all cross-family failed after fallback, reported by code-review as `cross_family_degraded`) → **pause**:
     ```
     ⚠️ Review ran in degraded mode (cross-family unavailable after fallback). Auto-pass blocked.
     Options:
     1. Accept Claude-only review and continue
     2. Retry (proxies may recover)
     ```
   - UNVERIFIED states block the gate — they are not true values
   - User can disable auto-pass in `pipeline.yml` → `work.auto_pass: false` if they prefer manual confirmation every step
5. All steps done → run **Knowledge capture (below) → Completion Invariant**, then `All steps complete. Next: /ae:review <plan-file-path>`

### Knowledge capture (Mengdie)

**Fires only when all plan steps are `[x]`** — per-step ingest is too noisy (TDD micro-commits aren't durable knowledge). Plan-completion is the right granularity: the operator now has a coherent unit of work to remember.

Order: this step runs AFTER the final step's commit lands AND BEFORE Completion Invariant (matches step 5 above). Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) for common rules.

**Skill-specific extraction**:
- 1 item per shipped feature reflecting *what was decided / changed at the plan level* — NOT per-commit summaries (those are git log's job). The "1 item" cap is intentionally stricter than the protocol's "max 3" default because plan-completion is a coarser unit than the per-call grain other skills use; a typical /ae:work plan ships 1 coherent feature.
- Skip if the work was a trivial mechanical refactor with no decisions worth remembering. This `scope: trivial` skip is an /ae:work-specific extension to the protocol's graceful-degradation list — appropriate because plan-completion can legitimately have zero durable knowledge (e.g., pure rename refactor).
- `source_type`: `review` (the experiential knowledge produced by executing a plan — rework rate, drift events, surprises — is review-class, not plan-class. `plan` is reserved for `/ae:plan`'s plan-document content; using it for /ae:work outcomes would confuse retrieval queries that filter by source_type).
- `knowledge_type`: `experiential` (rework rate, drift events, what surprised the implementation)
- `entities`: derive from plan file path (e.g., `f-007`, `entity-materialization`) + key technical surfaces touched
- `source_file`: path to the plan file

**Failure / conflict mode**: per [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) — graceful degradation, do NOT abort the skill if ingest fails (the commits are the primary artifact).

**Closing output** — report what was ingested:
- `Knowledge capture: [N] items ingested, no conflicts`
- Or: `Knowledge capture: [N] items ingested, conflicts detected with: [titles]`
- Or: `Knowledge capture: skipped (mengdie unavailable / scope: trivial)`

## Completion Invariant

When all plan steps are `[x]`, write pipeline state before suggesting next steps:

- [ ] Do NOT update plan `status` — leave as `reviewed`. ae:review will set `status: done` after verdict. This preserves the work → review handoff (ae:review argument inference filters `status: done`).
- [ ] Read plan `discussion:` field. If non-empty → read that discussion's `index.md`:
  - If `index.md` path does not exist → log `[WRITEBACK] Discussion index.md not found: <path>`, skip writeback (non-fatal, continue).
  - If discussion contains a comma-separated `discussion:` value (multi-parent — not currently supported by schema) → log `[WRITEBACK] Multi-parent discussion not supported: <value>`, skip writeback.
  - Otherwise, update two fields:
    - Set `pipeline.work: done` unconditionally (note: not read by dashboard/next, but documents completion)
    - Top-level `status:` field:
      - If current value is exactly `active` → overwrite to `concluded`. Log: `[WRITEBACK] Discussion status → concluded`
      - Any other value (`concluded`, `cancelled`, `revisit_requested`, etc.) → preserve as-is. Log: `[WRITEBACK] Discussion status preserved (current: <value>)`
  - Log: `[WRITEBACK] Discussion pipeline.work → done`
  - **Why two fields**: `pipeline.work` is the lifecycle state; top-level `status` is the human-readable label that `/ae:roadmap` reads (line 216: `status: active OR pipeline.discuss: in_progress` → "Discussing"). Writing `status: concluded` when it was `active` ensures roadmap stops labeling shipped work as still-discussing. Non-`active` values are preserved because the user may have explicitly set them (e.g., `cancelled`).
  - **Atomicity and idempotency**: the two writes (`pipeline.work: done` and conditional `status:`) are independent — each is idempotent on its own. If one fails the other still runs (best-effort, per-write log on failure). A second `/ae:work` run on the same plan is safe: `pipeline.work: done` → stays `done`, `status:` → already `concluded` takes the preserve path. No atomic-write guarantee needed because both outcomes are convergent under the preserve rule.
- [ ] If `discussion:` is empty → log: `[WRITEBACK] Standalone plan, no discussion`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit

## Next Steps

Based on work completion, suggest with exact executable command:
- If all plan steps completed → `Pipeline state updated. All steps complete. Next: /ae:review <plan-file-path>`
- If steps remain → auto-continue to next step (or pause if gate failed)
- If blockers encountered → `Blocker on Step N. Try: /ae:think <blocker description>`

## Trace emission (final step)

Before skill exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit 9-field trace record to `~/.ae/traces/<session-id>.ndjson` (no LLM content, per-skill-invocation metadata for v0.11.x consumers).
