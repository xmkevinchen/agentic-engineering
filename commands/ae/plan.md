---
name: ae:plan
description: Generate a feature plan with acceptance criteria + plan review
argument-hint: "<feature description>"
---

# /ae:plan — Feature Plan

Create an execution plan for: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists
2. If missing → suggest `/ae:setup`, **refuse to execute**

## Step 1: Research

1. Read project CLAUDE.md for conventions and constraints
2. Read `docs/` for development plan, architecture, existing decisions
3. Search codebase for related code, models, interfaces
4. Check `docs/backlog/` for related items
5. If a `docs/discussions/*/conclusion.md` is referenced, read the decisions

## Step 2: Write Plan

Write the plan file to the directory specified in `pipeline.yml` → `output.plans`.

### Structure

```markdown
# Feature: <title>

## Goal
One sentence: what problem does this feature solve.

## Steps

### Step 1: <description> (AC1)
- [ ] Subtask a
- [ ] Subtask b

### Step 2: <description> (AC2, AC3)
- [ ] Subtask a

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

## Step 3: Agent Teams Plan Review

After the plan is written, create a Team for parallel review:

```
TeamCreate(team_name: "<feature>-plan-review")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan's step decomposition and dependencies: <plan full text>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, simplicity-reviewer.
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
```

### Merge Results

Architect integrates feedback from dependency-analyst and simplicity-reviewer, then SendMessage to Lead.

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Close the Team. Modify plan based on results.

## Step 4: Confirm

Show the complete plan to the user. Indicate next step is `/ae:work <plan file path>`.

## Output

1. Plan file (with acceptance criteria + step-AC mapping + parallel strategy)
2. Plan review summary (with architect/analyst/simplifier discussion records)
