---
name: ae:plan
description: Generate a feature plan with acceptance criteria + plan review
argument-hint: "<feature description>"
---

# /ae:plan — Feature Plan

Create an execution plan for: **$ARGUMENTS**

## Pre-check

0. **Scratch recovery**: Scan scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`) for files with `project` matching current repo name AND `status: in_progress`. If found → list them and ask user: "Unfinished operations found from a previous session. Resume?"
1. Confirm `.claude/pipeline.yml` exists
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Research

1. Read project CLAUDE.md for conventions and constraints
2. Read `docs/` for development plan, architecture, existing decisions
3. Search codebase for related code, models, interfaces
4. Check `docs/backlog/` for related items
5. If a `docs/discussions/*/conclusion.md` is referenced, read the decisions and validate:
   - Has `## Decision Summary`? (non-empty)
   - Has `## Process Metadata`? (shows discussion was properly conducted)
   - Has spawned discussions? → warn: "Unresolved sub-discussions exist. Consider resolving before planning."
   - Missing sections → warn: "Conclusion may be incomplete (missing [section]). Proceed with caution."

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
Expected files: path/to/file1.ts, path/to/file2.ts

### Step 2: <description> (AC2, AC3)
- [ ] Subtask a
Expected files: path/to/file3.ts

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

After the plan is written, create a Team for parallel review.

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family (codex/gemini), include its proxy agent in the team. If a proxy fails to connect, it should SendMessage to **architect** (the lead) that it's unavailable, then exit gracefully — so the lead doesn't hang waiting.

```
TeamCreate(team_name: "<feature>-plan-review")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan's step decomposition and dependencies: <plan full text>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, simplicity-reviewer, codex-proxy, gemini-proxy.
               Produce step dependency graph and parallel strategy.
               SendMessage to dependency-analyst and simplicity-reviewer when done.")

Agent(subagent_type: "dependency-analyst", name: "dependency-analyst",
      team_name: "<team>", run_in_background: true,
      prompt: "Validate the architect's parallel assumptions in the step decomposition.
               Follow Team Communication Protocol.
               Teammates: architect, simplicity-reviewer.
               Wait for architect's proposal before analyzing.
               Hidden dependencies → SendMessage to architect with adjustment suggestions.")

Agent(subagent_type: "simplicity-reviewer", name: "simplicity-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Operate in /plan mode per Team Communication Protocol.
               Review the architect's step decomposition for complexity.
               Wait for architect's proposal before reviewing.
               Overly complex steps → SendMessage to architect with simplification suggestions.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan via Codex MCP for hidden dependencies and over-engineering: <plan full text>.
               Teammates: architect, dependency-analyst, simplicity-reviewer.
               SendMessage findings to architect when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan via Gemini MCP for architecture quality and industry practices: <plan full text>.
               Teammates: architect, dependency-analyst, simplicity-reviewer.
               SendMessage findings to architect when done.")
```

### Merge Results

Architect integrates feedback from dependency-analyst and simplicity-reviewer, then SendMessage to Lead.

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Close the Team. Modify plan based on results.

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
