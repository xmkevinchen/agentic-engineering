---
name: "cross-family-review"
description: "Cross-family review guide (Claude + Codex + Gemini). Reference this when invoking cross-family review tools. Passive knowledge skill, not a slash command."
---

# Cross-Family Review Guide

Three model families, different training biases, covering each other's blind spots.

## Three Model Families

| Family | Access | Role |
|--------|--------|------|
| **Claude** | Claude Code (current runtime) | Primary development, agent review |
| **Codex** | CLI / MCP | Cross-family primary, full repo access |
| **Gemini** | Gemini CLI / PAL MCP | Targeted review, architecture debate |

**Why cross-family**: Claude review agents (security-reviewer, simplicity-reviewer, etc.) are all Claude family, sharing training biases. Codex (OpenAI) and Gemini (Google) provide genuinely different perspectives.

---

## Codex (Primary Cross-Family)

### Invocation

**Prefer Bash direct call to Codex CLI** (avoids PAL `clink` 300s MCP timeout):

```bash
# Code Review (uncommitted changes)
codex review --uncommitted "Review focus: [context]"

# Code Review (branch changes)
codex review --base main

# Testgen / Planner / Second opinion (read-only tasks)
codex exec -s read-only "prompt"

# With working directory
codex exec -s read-only -C /path/to/dir "prompt"
```

> **Do not use PAL `clink codex`** — MCP tool layer has 300s hard timeout, Codex deep analysis can exceed it.
> Bash tool timeout 600s, and supports `run_in_background`.

### Characteristics

- Runs locally via Codex CLI
- OpenAI family — training bias distinctly different from Claude and Gemini
- **Has full local file access** — can read entire repo

### Usage Principles

- **Use liberally** — subscription cost is fixed; not using it is waste
- **Embed in workflow, don't rely on memory** — call at every stage per strategy table below
- **TDD red light must call testgen** — after writing test list, let Codex suggest edge cases
- **Call immediately after implementation, don't wait for commit**
- **Ask for second opinion when in doubt** on design trade-offs

---

## Gemini (Targeted Review, Has Quota)

Two invocation methods with **independent quotas**:

### Method 1: Gemini CLI

```bash
gemini -p "Review this code for [concern]:

$(cat /path/to/file.py)

Keep feedback concise (max 10 lines)."
```

- `-p` = single prompt mode, returns plain text
- May hit 429, auto-retry usually succeeds
- **No file access** — must `cat` file contents into prompt

### Method 2: PAL MCP Tools

PAL's `codereview`, `challenge`, `consensus` tools support Gemini models:

```
mcp__pal__codereview:
  model: "gemini-2.5-pro"
  ...
```

### Usage Principles

- **Has quota, save for high-value scenarios** — architecture decisions + security audit (~1-2 per feature)
- **Targeted, not sweeping** — only send 3-5 high-risk files (auth, data processing), not entire feature diff
- **CLI and PAL quotas are independent** — one exhausted, the other may still work

---

## Review Strategy by Stage

| Stage | Claude | Codex (required) | Gemini (optional) |
|-------|--------|-------------------|-------------------|
| Each commit | `code-reviewer` agent | `codex review --uncommitted` | — |
| Plan review | `architecture-reviewer` / `simplicity-reviewer` | `codex exec -s read-only "Review plan..."` | — |
| TDD red light | Write test list | `codex exec -s read-only "Suggest edge cases..."` | — |
| After implementation | Claude review | `codex review --uncommitted` | — |
| Feature complete | Project review agents (parallel) | `codex review --base main` | Security audit add-on (if auth/data involved) |
| Architecture decision | Propose approach | `codex exec -s read-only "Challenge approach..."` | `consensus` debate (optional) |
| Debugging stuck | Investigate | `codex exec -s read-only "Analyze problem..."` | — |

### Tool Selection Rules (Hard Rules)

```
All cross-family review → must go through Codex CLI (baseline)
Codex → use Bash direct call: codex review / codex exec (not PAL clink, avoids 300s timeout)
Gemini → optional add-on layer, after codex (security audit, architecture debate, etc.)
Gemini → use PAL clink(gemini) or PAL codereview/secaudit tools
Never skip codex and go straight to gemini
```

**Principle**: Codex is required baseline (fixed subscription, use liberally). Gemini is optional add-on (has quota, nice to have).

---

## PAL Tool Quick Reference

### Codex Tools (Primary, direct CLI, use liberally)

| Invocation | Purpose | Stage |
|------------|---------|-------|
| `codex review --uncommitted` | Code review (uncommitted) | commit review, after implementation |
| `codex review --base main` | Code review (branch) | feature complete |
| `codex exec -s read-only "..."` | General read-only task | testgen, planner, challenge, debug, second opinion |

> **Don't use PAL `clink codex`** — 300s MCP timeout too short. Bash CLI directly, 600s timeout.

### Gemini Tools (Optional add-on, after Codex)

| Tool | Purpose | Notes |
|------|---------|-------|
| `codereview` | Gemini structured review | Optional after Codex review |
| `secaudit` | Security audit | Optional after Codex review (high-risk files) |
| `consensus` | Multi-model debate | Optional for architecture decisions |
| `thinkdeep` | Deep reasoning | Optional when debugging is stuck |

---

## Common Pitfalls

1. **Gemini CLI 429** → capacity limit; auto-retry usually succeeds
2. **Gemini CLI has no repo context** → must paste code; Codex has full access. Match tool to need
3. **PAL continuation_id** → multi-step reviews lose context without reuse
4. **Same-family blind spots** → Claude review agents are all Claude family; use Codex/Gemini for perspective
