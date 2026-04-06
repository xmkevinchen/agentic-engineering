---
name: ae:code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[files or directory]"
user-invocable: true
effort: medium
---

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes.

## Trigger

1. **Auto** — `/ae:work` calls this before each commit
2. **Manual** — run `/ae:code-review` anytime

## Mode

- **full** (default): four parallel tracks (Claude + Codex + Gemini + Doodlestein)
- **light**: Track 1 only (Claude review, skip cross-family and Doodlestein)

Mode is set by caller (ae:work reads `work.review_mode` from pipeline.yml, or `--light`/`--full` flag). When called manually, defaults to `full`.

## Execution

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family** (full mode only): Read `cross_family` from pipeline.yml. For each enabled family, launch its proxy track in parallel. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback. In **light mode**, skip Tracks 2 and 3 entirely.

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

### Tracks 2-3: Cross-family Review (for each enabled proxy in pipeline.yml cross_family)

Launch each enabled proxy agent to review the diff with an `<assigned angle>`. TL picks angles first, assigns to available proxies. If both enabled, different angles.

### Track 4: Doodlestein Adversarial Challenge (full mode only)

**Purpose**: proactive adversarial challenge on the current diff — "what did the other tracks miss?"

Launch 1 combined Doodlestein agent (sonnet model, independent subagent — no team_name) with the current diff scope (`git diff + git diff --cached`). The agent answers 3 questions in a single pass:

```
Agent(subagent_type: "general-purpose", model: "sonnet",
      run_in_background: true,
      prompt: "You are a Doodlestein adversarial reviewer. Review ONLY the following diff
               (do NOT run git diff yourself, do NOT look at accumulated/feature-level changes):

               <current diff>

               Answer these 3 questions concisely (1-3 sentences each):

               1. STRATEGIC: What is the single smartest improvement to this change?
               2. ADVERSARIAL: What mistake, oversight, or blind spot exists in this change?
               3. REGRET: Which part of this change is most likely to be reverted or reworked?

               If the change is clean and you have no substantive concern for a question,
               say 'No concern.' Do not force issues.

               SendMessage your answers to team-lead.")
```

**Scope binding**: the diff is passed inline in the prompt. The agent MUST NOT independently query `git diff main...HEAD` or any accumulated diff. This keeps per-commit Doodlestein focused on the current step only.

**Results**: Track 4 findings are merged into the overall Results output:
- Substantive concern → **Warning**
- Critical blind spot (security, data loss) → **Block**
- "No concern" on all 3 → no output (silent pass)

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

