---
name: ae:think
description: Deep multi-step reasoning for complex architecture decisions, hard bugs, or performance analysis
argument-hint: "<problem or question>"
user-invocable: true
---

# /ae:think — Deep Analysis

Perform systematic deep analysis on: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Frame

1. Read project CLAUDE.md, relevant code, and docs
2. Identify the core question and constraints
3. Form initial hypothesis
4. List relevant files and modules

## Step 2: Agent Teams Investigation

Create a Team for parallel deep investigation (Investigation Mode). **TL synthesizes**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family).

```
TeamCreate(team_name: "<topic>-deep-think")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Analyze this problem from a structural/design perspective: <problem + hypothesis + relevant files>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger, codex-proxy, gemini-proxy.
               Produce analysis with evidence from code.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "Evaluate against industry best practices and known patterns: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, challenger.
               Wait for architect's analysis before evaluating.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Challenge the architect's analysis. Find blind spots, untested assumptions, alternative explanations: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, standards-expert.
               Wait for architect's analysis before challenging.
               SendMessage challenges to Lead (TL) when done.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent analysis of this problem via Codex MCP — <specialized focus based on context>: <problem + relevant files>.
               Teammates: architect, standards-expert, challenger.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent analysis of this problem via Gemini MCP — <specialized focus based on context>: <problem + relevant files>.
               Teammates: architect, standards-expert, challenger.
               SendMessage findings to Lead (TL) when done.")
```

## Step 3: TL Synthesizes

TL collects all findings and integrates perspectives:

- **Confirmed** — points all agents agree on
- **Contested** — disagreements with arguments from each side
- **Blind spots** — issues only raised by challenger or cross-family
- **Recommendation** — actionable conclusion with confidence level (low/medium/high)

Close the Team.

## Step 4: Persist

Write analysis directly to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`).

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

File naming: `NNN-slug.md` — three-digit sequential number + slug derived from topic.

```markdown
---
id: "NNN"
title: "Analysis: [topic]"
type: analysis
created: YYYY-MM-DD
status: done
---
```

Content sections:
- Problem statement
- Key findings
- Recommendation
- Dissenting views

Show summary to user.

## Next Steps

Based on thinking output, suggest:
- If recommendation is actionable → "Ready for `/ae:plan` to define implementation, or `/ae:discuss` if design decisions remain"
- If confidence is low → "Consider `/ae:analyze` for broader research, or `/ae:consensus` for structured debate"
- If problem is execution-level → "Ready for `/ae:work` or `/ae:testgen`"
