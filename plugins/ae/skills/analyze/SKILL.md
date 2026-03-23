---
name: ae:analyze
description: Research and analyze a topic, module, or problem domain in the codebase
argument-hint: "<topic or question>"
---

# /ae:analyze — Codebase Analysis

Research the codebase and generate a structured analysis for: **$ARGUMENTS**

## Pre-check

1. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ "experiments": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": true } }` to ~/.claude/settings.json and restart Claude Code."

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

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family (codex/gemini), include its proxy agent in the team. If a proxy fails to connect, it should SendMessage to **challenger** that it's unavailable, then exit gracefully — so challenger doesn't hang waiting.

```
TeamCreate(team_name: "<topic>-analyze")

Agent(subagent_type: "archaeologist", name: "archaeologist",
      team_name: "<team>", run_in_background: true,
      prompt: "Deeply investigate existing code for: <$ARGUMENTS>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger.
               SendMessage findings to challenger and standards-expert when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "Research industry best practices for: <$ARGUMENTS>.
               Follow Team Communication Protocol.
               Teammates: archaeologist, challenger.
               Wait for archaeologist's code analysis before comparing.
               SendMessage findings to challenger and archaeologist when done.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Operate in /analyze mode per Team Communication Protocol.
               Topic: <$ARGUMENTS>.
               Teammates: archaeologist, standards-expert, codex-proxy, gemini-proxy.
               Step 1: independent blind-spot review.
               Step 2: wait for all teammate + proxy findings, compare and merge.
               Step 3: challenge. Step 4: synthesize and send to Lead.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Research <$ARGUMENTS> via Codex MCP. Focus on code patterns and hidden issues.
               Teammates: challenger, archaeologist, standards-expert.
               SendMessage findings to challenger when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Research <$ARGUMENTS> via Gemini MCP. Focus on industry practices and architecture.
               Teammates: challenger, archaeologist, standards-expert.
               SendMessage findings to challenger when done.")
```

Also read project context files (CLAUDE.md, docs/) for background.

### 4. Generate Analysis Document

After Challenger sends the synthesized report, create `<output.discussions>/NNN-slug/analysis.md`:

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
