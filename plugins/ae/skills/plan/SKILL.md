---
name: ae:plan
description: Generate a feature plan with acceptance criteria + plan review. Recommended: Sonnet or above
argument-hint: "<feature description>"
user-invocable: true
model: opus
effort: high
---

## Argument Inference

Resolve `$ARGUMENTS` into an optional **source discussion directory** before running Pre-check. Three argument forms (in priority order):

### Form 1 — Discussion-dir path

If `$ARGUMENTS` starts with `.ae/discussions/` or matches `*/discussions/*/` (ends with `/`), accept as-is. Resolve:
- `conclusion.md` path = `<arg>/conclusion.md`
- `framing.md` path = `<arg>/framing.md` (optional, load-if-exists)

Example: `/ae:plan .ae/discussions/047-pipeline-quality-wave-cluster/`

### Form 2 — BL-ID

If `$ARGUMENTS` matches regex `^BL-\d{3}$` (e.g., `BL-033`):

1. Locate the BL file via `<output.backlog>/**/BL-NNN*.md` glob, where `<output.backlog>` is read from `pipeline.yml` (default: `.ae/backlog/`; projects with custom paths use their configured value). Traverse `unscheduled/`, `v*/`, `done/v*/` subdirs; exclude `closed/`.
2. Parse the BL file's YAML frontmatter `narrowed_by:` field. **Parse rule**: (a) strip everything from the first space, `+`, or newline onward; (b) strip a trailing `/conclusion.md` if present; (c) ensure the result ends with `/` (append if missing) — this normalizes to Form 1's directory format.
   - Example: `narrowed_by: ".ae/discussions/047-pipeline-quality-wave-cluster/conclusion.md + Addenda 4+5+6"` → after (a) `.ae/discussions/047-pipeline-quality-wave-cluster/conclusion.md` → after (b) `.ae/discussions/047-pipeline-quality-wave-cluster` → after (c) `.ae/discussions/047-pipeline-quality-wave-cluster/`
3. If `narrowed_by:` is missing/empty, fall back to body-text grep for a discussion reference: first match of `\.ae/discussions/[^ ]+/` (already terminates with `/`; skip normalization step c).
4. If no discussion reference resolves → **refuse**: `/ae:plan <BL-ID> — BL file has no resolvable discussion reference (checked frontmatter narrowed_by: and body-text). Supply the discussion directory explicitly: /ae:plan .ae/discussions/NNN-slug/`

Once resolved, treat as Form 1.

### Form 3 — Empty or free-text feature description

If `$ARGUMENTS` is empty:
1. Check `output.discussions` for the most recent discussion with `pipeline.discuss: done` and a `conclusion.md`
2. Found → use that as Form-1 source discussion
3. Not found → check conversation context for a topic being discussed
4. Still nothing → ask user what to plan

If `$ARGUMENTS` is free text (no discussion path, no BL-ID pattern): use as the feature title for a **standalone plan**. No source discussion is resolved; the discussion-dependent Pre-check does not fire; any discussion-dependent quality checks (Plan Quality Self-check and similar) skip as standalone-plan exemption.

### Argument-form error parity

Refusal wording MUST be consistent across Form 1 and Form 2 for the **same terminal condition** (both forms resolve to the same discussion dir, that dir's `conclusion.md` is missing) — both emit Pre-check item 4's "Discussion source valid" refusal. Distinct terminal conditions (Form 2 BL with no resolvable discussion reference at all vs Form 1 or Form 2 with a resolved-but-incomplete discussion) legitimately emit distinct messages targeted at the actionable fix for each.

# /ae:plan — Feature Plan

Create an execution plan for: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL writing plan directly (skip Step 3 team review + Step 4 Doodlestein). Plan stays `status: draft`. Output: "Plan created in solo mode. Run /ae:plan-review or enable Agent Teams before using with /ae:work."

## Step 1: Research

1. Read project CLAUDE.md for conventions and constraints
2. Read `docs/` for development plan, architecture, existing decisions
3. Search codebase for related code, models, interfaces
4. Check `output.backlog/**/*.md` (from pipeline.yml) for related items — traverse subdirs (`v*/`, `unscheduled/`); exclude `done/` and `closed/` unless specifically researching historical context
5. If a `docs/discussions/*/conclusion.md` is referenced, read the decisions and validate:
   - Check index.md `pipeline.discuss` — if still `in_progress` → **refuse**: "Discussion not concluded. Run `/ae:discuss` to complete."
   - Has `## Decision Summary` with at least one row where Decision column is non-empty and not "—"? — if no real decisions → **refuse**: "Conclusion has no decisions. Run `/ae:discuss` first."
   - Has `## Process Metadata`? — if missing → **refuse**: "Conclusion missing Process Metadata. May have bypassed discuss flow."
   - Has spawned discussions in `## Spawned Discussions`? → **refuse**: "Unresolved sub-discussions exist. Resolve them before planning."
   - Has deferred topics in index.md but no `## Deferred Resolutions` section? → **refuse**: "Sweep was skipped. Run `/ae:discuss` to resolve deferred items."
   - Has `## Deferred Resolutions` with `explained` items? → warn: "Some decisions based on assumptions. Review assumptions before planning."
   - `Autonomous decisions: 0` AND `User escalations: 0` in metadata → warn: "Discussion may not have been properly conducted (no decisions recorded)."
   - Missing other sections → warn: "Conclusion may be incomplete (missing [section]). Proceed with caution."

### 1.5. Prior Context (from Mengdie)

Run this step after Research (Step 1) and before Write Plan (Step 2).

1. Call `memory_search` MCP tool with the feature description ($ARGUMENTS) or the referenced discussion's problem statement as query
2. If `memory_search` is not available, fails, or returns no results — emit `Prior context: unavailable (tool not registered / no relevant results)` and continue to Step 2
3. If results returned with `degraded` field non-null — annotate results as "(partial — [degraded reason])"
4. Present results under `## Prior Art from Project Knowledge Base` with provenance for each item: `title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`
5. Factor prior art into plan design — reference relevant prior decisions when they constrain or inform the plan's approach

## Step 2: Write Plan

Write the plan file to the directory specified in `pipeline.yml` → `output.plans` (default: `docs/plans/`).

File naming: `NNN-slug.md` — three-digit sequential number + slug derived from title.

### Structure

```markdown
---
id: "NNN"
title: "<title>"
type: plan
created: YYYY-MM-DD
status: draft              # Valid status: draft | reviewed | done | cancelled
discussion: ""             # path to source discussion directory (e.g., ".ae/discussions/029-slug/")
---

# Feature: <title>

## Goal
One sentence: what problem does this feature solve.

## Steps

### Step 1: <description> (AC1)
- [ ] Subtask a
- [ ] Subtask b
Expected files: path/to/file1.ts, path/to/file2.ts   ← REQUIRED: list all files this step will modify

### Step 2: <description> (AC2, AC3)
- [ ] Subtask a
Expected files: path/to/file3.ts   ← REQUIRED: enables drift detection in /ae:work

## Acceptance Criteria

### AC1: Reference Case — <description>
<Specific known input/output pairs>

### AC2: Sanity Check — <description>
<Metric + reasonable range>

### AC3: Output Verification — <description>
<Human-verifiable output>
```

### Rules
- ACs must be **specific and verifiable** (no "results should be reasonable")
- Numbers must have ranges ("10-15%"), not point values ("12%")
- Each step references AC numbers (step-AC mapping)
- Each AC covered by at least one step
- Each step ≤ 3 ACs

### Plan Quality Self-check

After writing the plan, verify before proceeding to review:

1. **Step completeness**: Does every step have a clear completion condition? (not just "implement X" — what specifically is done when it's done?)
2. **AC verifiability**: Does every AC have a concrete verification method? (test command, manual check, metric threshold — not "results should be reasonable")
3. **Evidence for drift detection**: Does every step list the files expected to be modified? (This enables Phase 2 contract extraction for drift detection during `/ae:work`)

If any check fails → fix the plan before proceeding to review. These checks are self-checks by the writing agent, not a separate review step.

## Step 3: Agent Teams Plan Review

**Skip with `--skip-review`**: If the user passed `--skip-review` flag, skip this entire step and proceed to Step 4 (Doodlestein) or Step 5 (Confirm). Use when: simple changes where full 5-agent review is overhead.

> Note: Plan stays `status: draft`. Use `/ae:plan-review` before `/ae:work`.

After the plan is written, create a Team for parallel review.

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. For plan review, the "Plan review" row applies as baseline (architect + dependency-analyst). Add more based on plan content (e.g., plan involves DB migration → add performance-reviewer).

**Cross-family**: Follow the cross-family rules in the **Agent Selection Reference** skill — different angles per proxy, focused on the plan's domain. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

```
TeamCreate(team_name: "<feature>-plan-review")

# Architect reviews plan structure and dependencies:
Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan's step decomposition and dependencies: <plan full text>.
               Produce step dependency graph and parallel strategy.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "<reviewer-2>", name: "<reviewer-2>",
      team_name: "<team>", run_in_background: true,
      prompt: "<review focus>. SendMessage findings to team-lead when done.")

# Cross-family — for each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "<assigned angle>: <plan full text>.
               SendMessage findings to team-lead when done.")
```

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference.

### TL Merges Results

TL collects findings from all reviewers + cross-family, synthesizes:

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Modify plan based on results. Update plan frontmatter `status: reviewed`.

## Step 4: Doodlestein Challenge (optional)

Before confirming with the user, check cross-family availability (`cross_family` in pipeline.yml):

- **Cross-family available** → run Doodlestein challenge on the plan:
  - Compile: plan title + step summaries + AC list + key review findings
  - Spawn canonical Doodlestein agents INTO the existing plan-review team:
    ```
    Agent(subagent_type: "doodlestein-strategic", name: "doodlestein-strategic",
          team_name: "<existing team>", run_in_background: true,
          prompt: "<compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

    Agent(subagent_type: "doodlestein-adversarial", name: "doodlestein-adversarial",
          team_name: "<existing team>", run_in_background: true,
          prompt: "<compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

    Agent(subagent_type: "doodlestein-regret", name: "doodlestein-regret",
          team_name: "<existing team>", run_in_background: true,
          prompt: "<compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")
    ```
  - TL routes challenges to original review team members for response (per ae:agent-teams Doodlestein Protocol)
  - Valid challenge → modify plan accordingly
  - Refuted → record in plan review summary
- **Cross-family unavailable** → skip:
  ```
  ℹ️ Doodlestein challenge skipped: cross-family unavailable.
  ```

Close the Team after Doodlestein completes (or after Step 3 if Doodlestein skipped).

### 4.5. Knowledge Capture (to Mengdie)

Run this step after plan review completes (Step 3/4) and before Confirm (Step 5). **Gate**: only capture if plan `status: reviewed`. Skip for draft plans (unreviewed plans may contain superseded decisions).

Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) for common rules (max 3 items, atomic units, graceful degradation, conflict handling).

**Skill-specific extraction**:
- One item for the overall approach rationale from the Goal section
- Additional items only for non-obvious technical choices in the Steps
- Skip items that restate prior art already surfaced in Step 1.5
- `source_type`: `plan`
- `knowledge_type`: `decisional`
- `entities`: derive from each specific decision, NOT from the broad frontmatter `tags`. Use compound tags specific to the decision (e.g., `enum-validation-api-contract`, `phase-c-skill-wiring-pattern`). Avoid single broad tags.
- `source_file`: path to the generated plan file

**Closing output** — report what was ingested and any conflicts:
- `Knowledge capture: [N] items ingested, no conflicts`
- Or: `Knowledge capture: [N] items ingested, conflicts detected with: [titles]`

## Step 5: Confirm

Show the complete plan to the user. Indicate next step is `/ae:work <plan file path>`.

## Output

1. Plan file (with acceptance criteria + step-AC mapping + parallel strategy)
2. Plan review summary (with architect/analyst/simplifier discussion records)
3. Doodlestein review (if cross-family available)

## Completion Invariant

**Guard**: only fire if plan `status: reviewed` (i.e., plan review passed). If plan is still `status: draft` (review found Must Fix items), skip — do not write `pipeline.plan: done` for unreviewed plans.

When guard passes, write pipeline state:

- [ ] Read plan frontmatter `discussion:` field
- [ ] If `discussion:` is non-empty → read that discussion's `index.md`:
  - Set `plan: "<path-to-this-plan-file>"`
  - Set `pipeline.plan: done`
- [ ] If `discussion:` is empty → skip silently (standalone plan, no discussion to update)

## Next Steps

Based on plan status, suggest with exact executable command:
- If plan approved → `Pipeline state updated. Next: /ae:work <plan-file-path>`
- If plan has unresolved discussion references → `Unresolved discussions. Run /ae:discuss <discussion-dir> first.`
- If plan review raised Must Fix items → `Must Fix items remain. Re-run /ae:plan-review <plan-file-path>`
