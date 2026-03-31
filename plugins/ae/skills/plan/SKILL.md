---
name: ae:plan
description: Generate a feature plan with acceptance criteria + plan review
argument-hint: "<feature description>"
---

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

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. For plan review, the "Plan review" row applies as baseline (architect + dependency-analyst + simplicity-reviewer). Add more based on plan content (e.g., plan involves DB migration → add performance-reviewer).

**Cross-family**: Follow the cross-family rules in the **Agent Selection Reference** skill — same specialized prompt for both proxies, focused on the plan's domain. If a proxy fails to connect, it should SendMessage to **architect** (the lead) and exit gracefully.

```
TeamCreate(team_name: "<feature>-plan-review")

# Selected reviewers (example — actual selection based on plan context):
Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan's step decomposition and dependencies: <plan full text>.
               Produce step dependency graph and parallel strategy.
               SendMessage to other reviewers when done.")

Agent(subagent_type: "<reviewer-2>", ...)
Agent(subagent_type: "<reviewer-3>", ...)

# Cross-family (same specialized prompt):
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<specialized review focus based on plan domain>: <plan full text>.
               SendMessage findings to architect when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<same specialized focus as codex>: <plan full text>.
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
