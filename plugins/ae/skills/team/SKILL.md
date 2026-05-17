---
name: ae:team
description: Ad-hoc Agent Team — auto-selects agents based on context and task
argument-hint: "<task description>"
user-invocable: true
effort: medium
---

# /ae:team — Ad-hoc Agent Team

Spin up a task-specific Agent Team for: **$ARGUMENTS**

## Argument Inference

If `$ARGUMENTS` is empty:
1. Ask the user what task they want the team to work on
2. Provide examples: "e.g., 'investigate why auth tests are flaky', 'research migration options for the DB layer', 'review the API design for v2 endpoints'"
3. Do NOT proceed until a task description is provided

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:team creates exactly **3 tasks** per invocation (1 Pre-check + Team execution + Synthesis). The ad-hoc agent count is task-dependent (2-5 core agents per Rules section); all of them share the single "Team execution" task because the spawn count is content-driven, not skill-structural.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:team: Pre-check` | At skill start | Immediately before pre-check 1 | After pre-checks pass (control reaches Step 1 Analyze) |
| `ae:team: Team execution (N agents)` | At skill start (batch) | When the first spawned agent enters the team | When the last spawned agent's findings have arrived at TL (or shutdown_request acknowledged for non-responsive agents) |
| `ae:team: Synthesis` | At skill start (batch) | When TL begins merging findings into the final report | When the final report is persisted to `output.analyses` |

At skill start, batch-create:

```
TaskCreate(subject: "ae:team: Pre-check")
TaskCreate(subject: "ae:team: Team execution (N agents)")
TaskCreate(subject: "ae:team: Synthesis")
```

The N in "Team execution (N agents)" is a placeholder; substitute the actual count once Step 1 (Analyze Task) selects the agent roster. Updating the subject mid-flight via TaskUpdate is permitted to reflect the resolved count.

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:team: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After pre-checks pass, call `TaskUpdate(taskId, status: "completed")`.
Same lifecycle applies to Team execution and Synthesis phase tasks — `TaskUpdate(taskId, status: "in_progress")` when the phase begins, `TaskUpdate(taskId, status: "completed")` when the phase's completion criterion is met.

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists (needed for cross-family + agent config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL executing directly (no team spawn).

## Step 1: Analyze Task

Read the task description and determine:

Refer to the **Agent Selection Reference** skill for the selection table and rules. Use it to pick the right team based on task context.

## Step 2: Launch Team

**Before `TeamCreate`** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

```
TeamCreate(team_name: "<task-summary>")

# Launch selected agents (2-4 core + cross-family if needed)
# All agents SendMessage findings to team-lead. TL synthesizes.

Agent(subagent_type: "<agent1>", name: "<agent1>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <agent1>
                  Role: <ad-hoc role per task context — computed at TL spawn-decision time>
                  Angle: <ad-hoc focus>
                  Why: <ad-hoc rationale>

               <task context>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "<agent2>", name: "<agent2>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <agent2>
                  Role: <ad-hoc role per task context>
                  Angle: <ad-hoc focus from agent2's perspective>
                  Why: <ad-hoc rationale>

               <task from agent2's perspective>.
               Follow Team Communication Protocol.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")

# ... additional agents as needed (each spawn includes its own cast block per agent-teams/SKILL.md § Cast Block Syntax)
# Ad-hoc spawning pattern: TL computes cast block fields at spawn-decision time based on task context,
# unlike fixed-template skills where cast block fields are tied to known agent roles.

# Cross-family — for each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family ad-hoc reviewer (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled

               <task> via <proxy> MCP — <assigned angle>.
               Teammates: <list>.
               SendMessage findings to team-lead when done.")
```

## Step 3: TL Synthesizes

TL collects all findings from agents, synthesizes final report.

Close the Team.

## Persist

Write team results directly to `pipeline.yml` → `output.analyses` (default: `.ae/analyses/`) as `NNN-team-slug.md`.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show results to user.

## Rules

- **Minimum 2, maximum 5** core agents (excluding cross-family proxies)
- Don't launch agents that aren't relevant — fewer focused agents > many unfocused ones
- If the task clearly maps to an existing skill (`ae:think`, `ae:consensus`, `ae:testgen`, `ae:trace`), suggest that skill instead
- Project-specific agents take priority over built-in agents when roles match — follow agent-selection Rule 4 for discovery, role inference, and precedence (see [Agent Contract Specification](../../../docs/decisions/037-agent-contract.md))

## Next Steps

Based on team output, suggest:
- If team produced analysis → "Use findings to inform `/ae:discuss` or `/ae:plan`"
- If team produced implementation → "Run `/ae:review` or `/ae:code-review` on the changes"
- If team identified new questions → "Consider `/ae:think` or `/ae:analyze` for deeper investigation"
