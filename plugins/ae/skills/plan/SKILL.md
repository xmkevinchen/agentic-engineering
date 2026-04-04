---
name: ae:plan
description: Generate a feature plan with acceptance criteria + plan review
argument-hint: "<feature description>"
user-invocable: true
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.discussions` for the most recent discussion with `pipeline.discuss: done` and a `conclusion.md`
2. Found → use that conclusion as the basis: "Create plan based on docs/discussions/NNN-slug/conclusion.md"
3. Not found → check conversation context for a topic being discussed
4. Still nothing → ask user what to plan

# /ae:plan — Feature Plan

Create an execution plan for: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Research

1. Read project CLAUDE.md for conventions and constraints
2. Read `docs/` for development plan, architecture, existing decisions
3. Search codebase for related code, models, interfaces
4. Check `docs/backlog/` for related items
5. If a `docs/discussions/*/conclusion.md` is referenced, read the decisions and validate:
   - Check index.md `pipeline.discuss` — if still `in_progress` → **refuse**: "Discussion not concluded. Run `/ae:discuss` to complete."
   - Has `## Decision Summary` with at least one row where Decision column is non-empty and not "—"? — if no real decisions → **refuse**: "Conclusion has no decisions. Run `/ae:discuss` first."
   - Has `## Process Metadata`? — if missing → **refuse**: "Conclusion missing Process Metadata. May have bypassed discuss flow."
   - Has spawned discussions in `## Spawned Discussions`? → **refuse**: "Unresolved sub-discussions exist. Resolve them before planning."
   - Has deferred topics in index.md but no `## Deferred Resolutions` section? → **refuse**: "Sweep was skipped. Run `/ae:discuss` to resolve deferred items."
   - Has `## Deferred Resolutions` with `explained` items? → warn: "Some decisions based on assumptions. Review assumptions before planning."
   - `Autonomous decisions: 0` AND `User escalations: 0` in metadata → warn: "Discussion may not have been properly conducted (no decisions recorded)."
   - Missing other sections → warn: "Conclusion may be incomplete (missing [section]). Proceed with caution."

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
status: draft
discussion: ""           # link to conclusion.md if exists
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

After the plan is written, create a Team for parallel review.

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. For plan review, the "Plan review" row applies as baseline (architect + dependency-analyst). Add more based on plan content (e.g., plan involves DB migration → add performance-reviewer).

**Cross-family**: Follow the cross-family rules in the **Agent Selection Reference** skill — same specialized prompt for both proxies, focused on the plan's domain. If a proxy fails to connect, it should SendMessage to **Lead (TL)** and exit gracefully.

```
TeamCreate(team_name: "<feature>-plan-review")

# Architect reviews plan structure and dependencies:
Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan's step decomposition and dependencies: <plan full text>.
               Produce step dependency graph and parallel strategy.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "<reviewer-2>", name: "<reviewer-2>",
      team_name: "<team>", run_in_background: true,
      prompt: "<review focus>. SendMessage findings to Lead (TL) when done.")

# Cross-family (same specialized prompt):
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<specialized review focus based on plan domain>: <plan full text>.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<same specialized focus as codex>: <plan full text>.
               SendMessage findings to Lead (TL) when done.")
```

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference.

### TL Merges Results

TL collects findings from all reviewers + cross-family, synthesizes:

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Close the Team. Modify plan based on results. Update plan frontmatter `status: reviewed`.

## Step 4: Doodlestein Challenge (optional)

Before confirming with the user, check cross-family availability (`cross_family` in pipeline.yml):

- **Cross-family available** → run Doodlestein challenge on the plan:
  - Compile: plan title + step summaries + AC list
  - Send to cross-family (codex-proxy + gemini-proxy + challenger) with 3 questions:
    - Q1 Smartest Alternative: Is there a fundamentally different approach that makes this plan unnecessary?
    - Q2 Problem Validity: Which step solves a problem that doesn't actually exist?
    - Q3 Regret Prediction: Which step will be reworked or removed, and why?
  - Present challenges to user
  - User agrees → modify plan accordingly
  - User dismisses → record in plan review summary
- **Cross-family unavailable** → skip:
  ```
  ℹ️ Doodlestein challenge skipped: cross-family unavailable.
  ```

## Step 5: Confirm

Show the complete plan to the user. Indicate next step is `/ae:work <plan file path>`.

## Output

1. Plan file (with acceptance criteria + step-AC mapping + parallel strategy)
2. Plan review summary (with architect/analyst/simplifier discussion records)
3. Doodlestein review (if cross-family available)

## Next Steps

Based on plan status, suggest with exact executable command:
- If plan approved → `Plan reviewed. Next: /ae:work <plan-file-path>`
- If plan has unresolved discussion references → `Unresolved discussions. Run /ae:discuss <discussion-dir> first.`
- If plan review raised Must Fix items → `Must Fix items remain. Re-run /ae:plan-review <plan-file-path>`
