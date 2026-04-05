---
name: ae:team
description: Ad-hoc Agent Team — auto-selects agents based on context and task
argument-hint: "<task description>"
user-invocable: true
---

# /ae:team — Ad-hoc Agent Team

Spin up a task-specific Agent Team for: **$ARGUMENTS**

## Argument Inference

If `$ARGUMENTS` is empty:
1. Ask the user what task they want the team to work on
2. Provide examples: "e.g., 'investigate why auth tests are flaky', 'research migration options for the DB layer', 'review the API design for v2 endpoints'"
3. Do NOT proceed until a task description is provided

## Pre-check

1. Confirm `.claude/pipeline.yml` exists (needed for cross-family + agent config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL executing directly (no team spawn).

## Step 1: Analyze Task

Read the task description and determine:

Refer to the **Agent Selection Reference** skill for the selection table and rules. Use it to pick the right team based on task context.

## Step 2: Launch Team

```
TeamCreate(team_name: "<task-summary>")

# Launch selected agents (2-4 core + cross-family if needed)
# All agents SendMessage findings to team-lead. TL synthesizes.

Agent(subagent_type: "<agent1>", name: "<agent1>",
      team_name: "<team>", run_in_background: true,
      prompt: "<task context>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "<agent2>", name: "<agent2>",
      team_name: "<team>", run_in_background: true,
      prompt: "<task from agent2's perspective>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")

# ... additional agents as needed

# Cross-family (if enabled and needed)
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<task> via Codex MCP.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<task> via Gemini MCP.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")
```

## Step 3: TL Synthesizes

TL collects all findings from agents, synthesizes final report.

Close the Team.

## Persist

Write team results directly to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-team-slug.md`.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show results to user.

## Rules

- **Minimum 2, maximum 5** core agents (excluding cross-family proxies)
- Don't launch agents that aren't relevant — fewer focused agents > many unfocused ones
- If the task clearly maps to an existing skill (`ae:think`, `ae:consensus`, `ae:testgen`, `ae:trace`), suggest that skill instead
- Project-specific agents (auto-discovered from all sources, or `pipeline.yml` override) take priority over plugin's built-in agents when they match the task domain

## Next Steps

Based on team output, suggest:
- If team produced analysis → "Use findings to inform `/ae:discuss` or `/ae:plan`"
- If team produced implementation → "Run `/ae:review` or `/ae:code-review` on the changes"
- If team identified new questions → "Consider `/ae:think` or `/ae:analyze` for deeper investigation"
