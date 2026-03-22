---
name: ae:team
description: Ad-hoc Agent Team — auto-selects agents based on context and task
argument-hint: "<task description>"
---

# /ae:team — Ad-hoc Agent Team

Spin up a task-specific Agent Team for: **$ARGUMENTS**

## Pre-check

0. **Scratch recovery**: Scan scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`) for files with `project` matching current repo name AND `status: in_progress`. If found → list them and ask user: "上次有未完成的操作，要继续吗？"
1. Confirm `.claude/pipeline.yml` exists (needed for cross-family + agent config)
2. If missing → suggest `/ae:setup`

## Step 1: Analyze Task

Read the task description and determine:

1. **Task type** — which category best fits:
   - `architecture` → architect, dependency-analyst, simplicity-reviewer
   - `security` → security-reviewer, architect, code-reviewer
   - `performance` → performance-reviewer, architect, dependency-analyst
   - `debug` → archaeologist, dependency-analyst, qa
   - `review` → code-reviewer, security-reviewer, performance-reviewer
   - `research` → archaeologist, standards-expert, dependency-analyst
   - `design` → architect, challenger, simplicity-reviewer
   - `general` → architect, challenger, qa

2. **Cross-family needed?** — if task involves review, validation, or decision-making → yes
3. **Project agents** — check `agents.*` in pipeline.yml for domain-specific agents that match the task
4. **Lead agent** — pick the most relevant agent as lead (collects and synthesizes)

Show selected team to user before launching. User can adjust.

## Step 2: Launch Team

```
TeamCreate(team_name: "<task-summary>")

# Launch selected agents (2-4 core + cross-family if needed)
# Lead agent prompt includes: collect findings from teammates, synthesize, SendMessage to Lead

Agent(subagent_type: "<lead>", name: "<lead>",
      team_name: "<team>", run_in_background: true,
      prompt: "<task context>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               You are the lead. Collect findings, synthesize, SendMessage final report to Lead.")

Agent(subagent_type: "<agent2>", name: "<agent2>",
      team_name: "<team>", run_in_background: true,
      prompt: "<task from agent2's perspective>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               SendMessage findings to <lead> when done.")

# ... additional agents as needed

# Cross-family (if enabled and needed)
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<task> via Codex MCP.
               Teammates: <list>.
               SendMessage findings to <lead> when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "<task> via Gemini MCP.
               Teammates: <list>.
               SendMessage findings to <lead> when done.")
```

## Step 3: Result

Lead agent synthesizes all findings and sends report.

Close the Team.

## Scratch Persistence

Auto-save team results to scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`). File: `team-YYYY-MM-DD-NNN.md` with frontmatter `type: team`, `project: <repo-name>`, `created`, `status: done`, `task: <$ARGUMENTS>`.

Do NOT ask user about formal persistence — team results are ephemeral working artifacts.

Show results to user.

## Rules

- **Minimum 2, maximum 5** core agents (excluding cross-family proxies)
- Don't launch agents that aren't relevant — fewer focused agents > many unfocused ones
- If the task clearly maps to an existing skill (`ae:think`, `ae:consensus`, `ae:testgen`, `ae:trace`), suggest that skill instead
- Project-specific agents from pipeline.yml take priority over generic agents when they match the task domain
