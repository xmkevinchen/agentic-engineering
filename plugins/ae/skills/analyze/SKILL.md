---
name: ae:analyze
description: Research and analyze a topic, module, or problem domain in the codebase
argument-hint: "<topic or question>"
user-invocable: true
---

# /ae:analyze — Codebase Analysis

Research the codebase and generate a structured analysis for: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }` to ~/.claude/settings.json and restart Claude Code."

## Flow

### 1. Find or Create Discussion Directory

Read `pipeline.yml` → `output.discussions` (default: `docs/discussions/`). Check that directory for an existing related directory (match by topic).
- **Exists**: add analysis to that directory.
- **New**: find the highest existing number, take next sequential (zero-padded 3 digits, starting `001`). Create `<output.discussions>/NNN-slug/`.

### 2. Create or Update index.md

If no `index.md` in the directory, create:

```markdown
---
id: "NNN"
title: "[short topic title]"
status: active
created: YYYY-MM-DD
pipeline:
  analyze: done
  discuss: pending
  plan: pending
  work: pending
plan: ""
tags: [relevant, tags]
---

# [Title]

[One-sentence description]

## Topics
*Created by `/ae:discuss`*

## Documents
- [Analysis](analysis.md)
- [Plan](../../milestones/vX.X.X/xxx.md) *(linked after plan creation)*
```

If `index.md` already exists, update `pipeline.analyze` to `done` and add the analysis link.

### 3. Agent Teams Research

Create a Team and launch Teammates in parallel.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family (codex/gemini), include its proxy agent in the team. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family).

```
TeamCreate(team_name: "<topic>-analyze")

Agent(subagent_type: "archaeologist", name: "archaeologist",
      team_name: "<team>", run_in_background: true,
      prompt: "Deeply investigate existing code for: <$ARGUMENTS>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "Research industry best practices for: <$ARGUMENTS>.
               Follow Team Communication Protocol.
               Teammates: archaeologist, challenger.
               Wait for archaeologist's code analysis before comparing.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Challenge findings from archaeologist and standards-expert for: <$ARGUMENTS>.
               Follow Team Communication Protocol.
               Teammates: archaeologist, standards-expert, codex-proxy, gemini-proxy.
               Step 1: independent blind-spot review.
               Step 2: wait for teammate findings, then challenge.
               SendMessage challenges to team-lead when done.
               You are pure opposition. Do NOT synthesize — TL synthesizes.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Research <$ARGUMENTS> via Codex MCP — <specialized focus based on context>.
               Teammates: archaeologist, standards-expert, challenger.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Research <$ARGUMENTS> via Gemini MCP — <specialized focus based on context>.
               Teammates: archaeologist, standards-expert, challenger.
               SendMessage findings to team-lead when done.")
```

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference.

Also read project context files (CLAUDE.md, docs/) for background.

### 4. TL Synthesizes + Generate Analysis Document

TL collects findings from archaeologist, standards-expert, challenger, and cross-family proxies. Synthesize into analysis document at `<output.discussions>/NNN-slug/analysis.md`:

```markdown
---
id: "NNN"
title: "Analysis: [topic]"
type: analysis
created: YYYY-MM-DD
tags: [relevant, tags]
---

# Analysis: [topic]

## Question
[Original topic or question]

## Findings

### Relevant Code
[Key files and modules with paths (from Archaeologist)]

### Architecture & Patterns
[How the codebase handles similar scenarios. Design patterns used.]

### Industry Practice Comparison
[Project status vs industry standards (from Standards Expert)]

### Challenges & Disagreements
[Challenger's challenges + cross-family opinions (from Challenger)]

## Summary
[Concise answer to the original question. Key takeaways.]

## Possible Next Steps
[Suggest `/ae:discuss` or `/ae:plan`]
```

### 5. Close Team + Present

Send shutdown_request to all teammates. Show the user:
1. Key findings in concise form
2. Where the full analysis is saved
3. **Suggested next step based on findings**

## Principles

- Include file path references with line numbers where possible
- Focus on facts and code evidence, not speculation
- Keep analysis focused on the question asked
- If analysis reveals the problem is more complex than expected, state it clearly

## Next Steps

Based on analysis output, suggest:
- If analysis identifies decision points → "Ready for `/ae:discuss <analysis-dir>` to resolve design decisions"
- If analysis confirms a clear path with no open questions → "Ready for `/ae:plan` to define implementation steps"
- If analysis reveals the problem needs deeper investigation → "Consider `/ae:trace` or `/ae:think` for focused deep-dive"
