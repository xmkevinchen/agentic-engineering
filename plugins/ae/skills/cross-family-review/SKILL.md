---
name: ae:cross-family-review
description: "Cross-family review guide (Claude + Codex + Gemini). Reference this when invoking cross-family review tools. Passive knowledge skill, not a slash command."
---

# Cross-Family Review Guide

Three model families, different training biases, covering each other's blind spots.

## Three Model Families

| Family | MCP Tool | Role |
|--------|----------|------|
| **Claude** | (current runtime) | Primary development, agent review |
| **Codex** | `mcp__codex__codex` | Cross-family primary, full repo access |
| **Gemini** | `mcp__ae-gemini__chat` | Targeted review, architecture debate |

**Why cross-family**: Claude review agents (security-reviewer, simplicity-reviewer, etc.) are all Claude family, sharing training biases. Codex (OpenAI) and Gemini (Google) provide genuinely different perspectives.

---

## Codex (Primary Cross-Family)

### Invocation

Via MCP — the Codex MCP server has full local repo access:

```
# Code review
mcp__codex__codex(prompt: "Review these changes for security and correctness:\n\n<diff or context>")

# Testgen / second opinion
mcp__codex__codex(prompt: "Suggest edge case tests for this function:\n\n<code>")

# Challenge a design decision
mcp__codex__codex(prompt: "Challenge this approach: <description>. What could go wrong?")
```

### Characteristics

- OpenAI family — training bias distinctly different from Claude and Gemini
- Has full local file access via its MCP server
- Can read entire repo for context

### Usage Principles

- **Use liberally** — subscription cost is fixed; not using it is waste
- **Embed in workflow, don't rely on memory** — call at every stage per strategy table below
- **TDD red light must call testgen** — after writing test list, let Codex suggest edge cases
- **Call immediately after implementation, don't wait for commit**
- **Ask for second opinion when in doubt** on design trade-offs

---

## Gemini (Targeted Review)

### Invocation

Via the ae plugin's built-in Gemini MCP server (multi-turn capable):

```
# Start a conversation — returns sessionId for follow-ups
mcp__ae-gemini__chat(
  prompt: "Review this code for [concern]:\n\n<code>",
  model: "gemini-2.5-flash"
)

# Continue the conversation (multi-turn)
mcp__ae-gemini__reply(
  sessionId: "<from previous chat>",
  prompt: "Now focus on the error handling in lines 42-60"
)

# Switch to pro model mid-conversation for deeper analysis
mcp__ae-gemini__reply(
  sessionId: "<same session>",
  prompt: "Analyze the architecture implications",
  model: "gemini-2.5-pro"
)

# Check server status + active sessions
mcp__ae-gemini__info()
```

### Auth

The server supports two auth methods (auto-detected at startup):
1. `GEMINI_API_KEY` env var — simplest, check first
2. OAuth — reads `~/.gemini/oauth_creds.json` (shared with `gemini` CLI)

### Usage Principles

- **May have quota limits** — save for high-value scenarios (architecture decisions + security audit)
- **Targeted, not sweeping** — only send high-risk files (auth, data processing), not entire feature diff
- **Use flash for quick reviews, pro for deep analysis**

---

## Review Strategy by Stage

| Stage | Claude | Codex (required) | Gemini (optional) |
|-------|--------|-------------------|-------------------|
| Each commit | `code-reviewer` agent | `mcp__codex__codex` review | — |
| Plan review | `architect` / `simplicity-reviewer` | `mcp__codex__codex` plan review | — |
| TDD red light | Write test list | `mcp__codex__codex` testgen | — |
| After implementation | Claude review | `mcp__codex__codex` review | — |
| Feature complete | Review agents (parallel) | `mcp__codex__codex` deep review | `mcp__ae-gemini__chat` security audit |
| Architecture decision | Propose approach | `mcp__codex__codex` challenge | `mcp__ae-gemini__chat` debate |
| Debugging stuck | Investigate | `mcp__codex__codex` analyze | — |

### Tool Selection Rules (Hard Rules)

```
All cross-family review → must include Codex MCP (baseline)
Gemini → optional add-on layer, after Codex
Never skip Codex and go straight to Gemini
Both tools are MCP-native — no Bash CLI or PAL needed
```

**Principle**: Codex is required baseline (use liberally). Gemini is optional add-on (targeted, high-value).

---

## Common Pitfalls

1. **Gemini 429** → quota/capacity limit; retry or switch to flash model
2. **Codex MCP not available** → ensure Codex MCP server is configured in Claude Code settings
3. **Same-family blind spots** → Claude review agents are all Claude family; use Codex/Gemini for perspective
4. **Sending too much context to Gemini** → keep prompts focused; Codex has full repo access, Gemini gets only what you send
