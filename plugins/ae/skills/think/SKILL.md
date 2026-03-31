---
name: ae:think
description: Deep multi-step reasoning for complex architecture decisions, hard bugs, or performance analysis
argument-hint: "<problem or question>"
---

# /ae:think — Deep Analysis

Perform systematic deep analysis on: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Frame

1. Read project CLAUDE.md, relevant code, and docs
2. Identify the core question and constraints
3. Form initial hypothesis
4. List relevant files and modules

## Step 2: Agent Teams Investigation

Create a Team for parallel deep investigation. **Lead: architect** (collects and synthesizes).

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. If a proxy fails to connect, it should SendMessage to **architect** (the lead) that it's unavailable, then exit gracefully.

```
TeamCreate(team_name: "<topic>-deep-think")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Analyze this problem from a structural/design perspective: <problem + hypothesis + relevant files>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger, codex-proxy, gemini-proxy.
               Produce analysis with evidence from code.
               SendMessage to standards-expert and challenger when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "Evaluate against industry best practices and known patterns: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, challenger.
               Wait for architect's analysis before evaluating.
               SendMessage agreements and disagreements to architect.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Challenge the architect's analysis. Find blind spots, untested assumptions, alternative explanations: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, standards-expert.
               Wait for architect's analysis before challenging.
               SendMessage counterarguments to architect.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent analysis of this problem via Codex MCP — <specialized focus based on context>: <problem + relevant files>.
               Teammates: architect, standards-expert, challenger.
               SendMessage findings to architect when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent analysis of this problem via Gemini MCP — <specialized focus based on context>: <problem + relevant files>.
               Teammates: architect, standards-expert, challenger.
               SendMessage findings to architect when done.")
```

## Step 3: Synthesize

Architect integrates all perspectives:

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
