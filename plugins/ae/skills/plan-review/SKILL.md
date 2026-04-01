---
name: ae:plan-review
description: Re-review an existing plan with Agent Teams (standalone plan review without regenerating)
argument-hint: "<plan file path>"
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with `status: draft` or `status: reviewed`
2. Found → use that plan file path
3. Not found → ask user which plan to review

# /ae:plan-review — Plan Review

Review the plan at **$ARGUMENTS** using Agent Teams.

## Pre-check

1. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ "experiments": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": true } }` to ~/.claude/settings.json and restart Claude Code."
2. Confirm `.claude/pipeline.yml` exists
3. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
4. Read the plan file at `$ARGUMENTS` — confirm it exists and contains `## Steps` and `## Acceptance Criteria`
5. If missing → **refuse to execute**: "Plan file not found. Use `/ae:plan <feature>` to create one."

## Step 1: Agent Teams Plan Review

Read the full plan text, then create a Team for parallel review.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

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
      prompt: "Review this plan via Codex MCP — <specialized focus based on context>: <plan full text>.
               Teammates: architect, dependency-analyst, simplicity-reviewer.
               SendMessage findings to architect when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this plan via Gemini MCP — <specialized focus based on context>: <plan full text>.
               Teammates: architect, dependency-analyst, simplicity-reviewer.
               SendMessage findings to architect when done.")
```

## Step 2: Merge Results

Architect integrates feedback from dependency-analyst and simplicity-reviewer, then SendMessage to Lead.

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Close the Team.

## Step 3: Apply and Confirm

If there are "Must fix" items:
1. Show findings to user
2. Ask: "Apply fixes to the plan?"
3. If yes → modify plan file, update frontmatter `status: reviewed`
4. If no → leave plan as-is, show findings for manual action

If approved with no must-fix:
1. Update plan frontmatter `status: reviewed`
2. Show review summary

Show the plan to the user. Indicate next step is `/ae:work <plan file path>`.

## Output

1. Plan review summary (with architect/analyst/simplifier discussion records)
2. Updated plan file (if fixes applied)

## Next Steps

Based on review outcome, suggest:
- If plan approved → "Ready for `/ae:work <plan-file>` to execute implementation"
- If Must Fix items remain → "Address findings and re-run `/ae:plan-review`"
- If plan needs fundamental rethinking → "Consider `/ae:discuss` to revisit design decisions"
