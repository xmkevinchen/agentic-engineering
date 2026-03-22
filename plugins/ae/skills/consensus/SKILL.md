---
name: ae:consensus
description: Multi-agent structured debate (for/against/neutral) to evaluate proposals and decisions
argument-hint: "<proposal or decision to evaluate>"
---

# /ae:consensus — Structured Debate

Build multi-perspective consensus on: **$ARGUMENTS**

## Pre-check

0. **Scratch recovery**: Scan scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`) for files with `project` matching current repo name AND `status: in_progress`. If found → list them and ask user: "Unfinished operations found from a previous session. Resume?"
1. Confirm `.claude/pipeline.yml` exists (needed for cross-family config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.

## Step 1: Frame the Proposal

1. Read project CLAUDE.md and relevant code/docs
2. Formulate the proposal as a clear evaluatable statement
3. Identify what's at stake (reversibility, blast radius, complexity)

## Step 2: Agent Teams Debate

Create a Team with explicit stances. **Lead: mediator** (collects and synthesizes). Each agent argues from their assigned position.

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
      prompt: "Independent evaluation of this proposal via Codex MCP: <proposal + context>.
               Teammates: advocate, critic, mediator.
               SendMessage findings to mediator when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent evaluation of this proposal via Gemini MCP: <proposal + context>.
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

1. **Auto-save to scratch**: Write verdict to scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`). File: `consensus-YYYY-MM-DD-NNN.md` with frontmatter `type: consensus`, `project: <repo-name>`, `created`, `status: done`, `proposal: <$ARGUMENTS>`.
2. **Ask user**: Use `AskUserQuestion` — "Debate results saved to scratch. Formally save to `<output.analyses>`?"
   - **Yes** → copy to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-consensus-slug.md`
   - **No** → keep in scratch only

Show verdict to user.
