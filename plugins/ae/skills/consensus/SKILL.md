---
name: ae:consensus
description: Multi-agent structured debate (for/against/neutral) to evaluate proposals and decisions
argument-hint: "<proposal or decision to evaluate>"
---

# /ae:consensus — Structured Debate

Build multi-perspective consensus on: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists (needed for cross-family config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Frame the Proposal

1. Read project CLAUDE.md and relevant code/docs
2. Formulate the proposal as a clear evaluatable statement
3. Identify what's at stake (reversibility, blast radius, complexity)

## Step 2: Agent Teams Debate

Create a Team with explicit stances. **Lead: mediator** (collects and synthesizes). Each agent argues from their assigned position.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents as additional neutral evaluators. If a proxy fails to connect, it should SendMessage to **mediator** (the lead) that it's unavailable, then exit gracefully.

```
TeamCreate(team_name: "<topic>-consensus")

Agent(subagent_type: "architect", name: "advocate",
      team_name: "<team>", run_in_background: true,
      prompt: "STANCE: FOR. Argue in favor of this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: critic, mediator, codex-proxy, gemini-proxy.
               Present strongest arguments with evidence from codebase.
               Acknowledge weaknesses honestly.
               SendMessage to mediator when done.")

Agent(subagent_type: "challenger", name: "critic",
      team_name: "<team>", run_in_background: true,
      prompt: "STANCE: AGAINST. Argue against this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: advocate, mediator, codex-proxy, gemini-proxy.
               Find risks, hidden costs, better alternatives.
               Acknowledge strengths honestly.
               SendMessage to mediator when done.")

Agent(subagent_type: "simplicity-reviewer", name: "mediator",
      team_name: "<team>", run_in_background: true,
      prompt: "STANCE: NEUTRAL. Evaluate both sides of this proposal: <proposal>.
               Follow Team Communication Protocol.
               Teammates: advocate, critic, codex-proxy, gemini-proxy.
               Wait for both advocate and critic to finish.
               Identify: areas of agreement, genuine disagreements, and missing considerations.
               Synthesize a recommendation. SendMessage to advocate and critic for final response.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent evaluation of this proposal via Codex MCP — <specialized focus based on context>: <proposal + context>.
               Teammates: advocate, critic, mediator.
               SendMessage findings to mediator when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent evaluation of this proposal via Gemini MCP — <specialized focus based on context>: <proposal + context>.
               Teammates: advocate, critic, mediator.
               SendMessage findings to mediator when done.")
```

## Step 3: Verdict

Mediator produces final recommendation:

- **Consensus**: all sides agree → proceed / reject
- **Majority**: 2/3+ agree → proceed with noted risks
- **Split**: no clear winner → present both paths, ask user to decide

Include:
- Strongest argument for
- Strongest argument against
- Cross-family perspective
- Final recommendation

Close the Team.

## Step 4: Persist

Write verdict directly to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-consensus-slug.md`.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show verdict to user.
