---
name: ae:code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[files or directory]"
---

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes.

## Trigger

1. **Auto** — `/ae:work` calls this before each commit
2. **Manual** — run `/ae:code-review` anytime

## Mode

- **full** (default): three parallel tracks (Claude + Codex + Gemini)
- **light**: Track 1 only (Claude review, skip cross-family)

Mode is set by caller (ae:work reads `work.review_mode` from pipeline.yml, or `--light`/`--full` flag). When called manually, defaults to `full`.

## Execution

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family** (full mode only): Read `cross_family` from pipeline.yml. For each enabled family, launch its proxy track in parallel. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family). In **light mode**, skip Tracks 2 and 3 entirely.

**Degraded signal**: After all tracks complete, report cross-family coverage:
- All requested tracks completed → `cross_family_complete`
- Some proxy failed but fallback succeeded → `cross_family_complete` (fallback counts)
- All cross-family failed (after fallback) → `cross_family_degraded`

### Track 1: Claude Review

Check `git diff --stat` to determine change scope. Then:

- Discover reviewer agents at runtime: scan all available agents (project `.claude/agents/`, installed plugins, user global `~/.claude/agents/`) whose description indicates a code reviewer role.
- If project reviewers found: launch matching agents based on changed file types
- If none found: use the plugin's built-in `code-reviewer` agent

Review `git diff` + `git diff --cached`.

### Track 2: Codex Review

Launch `codex-proxy` agent to review the same diff via Codex MCP.

### Track 3: Gemini Review

Launch `gemini-proxy` agent to review the same diff via Gemini MCP.

## Results

Output directly to terminal:

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**

## Next Steps

Based on review outcome, suggest:
- If all OK → "Code is clean. Proceed with commit"
- If has Block findings → "Fix blocking issues before commit"
- If part of `/ae:work` flow → return to work's pre-commit checks

