---
name: ae:work
description: Execute plan (TDD + commit + review, pre-checks chain)
argument-hint: "<plan file path>"
---

# /ae:work — Execute Plan

Execute the plan at **$ARGUMENTS**.

## Pre-checks (all must pass before starting)

### Check 0: Scratch Recovery
Scan scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`) for files with `project` matching current repo name AND `status: in_progress`. If found → list them and ask user: "Unfinished operations found from a previous session. Resume?" Resolve before proceeding.

### Check 1: Plan Exists
- Read the plan file, confirm it exists and contains `## Acceptance Criteria` or `## AC`
- If missing → suggest `/ae:plan`, **refuse to execute**

### Check 2: Locate Current Step
- Scan all step checkboxes in the plan
- `- [x]` = done, `- [ ]` = pending
- Current step = first pending one
- All done → suggest `/ae:review`, **refuse to execute**

### Check 3: Agent Teams
- Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`
- If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

### Check 4: Deferred Items
- Read `pipeline.yml` → `output.milestones` (default: `docs/milestones/`), check `*/notes.md` (if exists)
- Find deferred items tagged for the current step
- **Has unresolved items → list them, resolve before continuing**
- None → pass

Output pre-check results:

```
Pre-checks:
✅ Plan exists: docs/milestones/v0.0.x/plan.md
✅ Current step: Step 3 (Steps 1-2 done)
✅ Deferred items: none (or list)
```

## Execution Mode Selection

### Single-platform Step → Lead Executes Directly

Lead follows the TDD cycle directly, no Team created.

### Parallel Steps (multiple developers) → Agent Teams

When the plan's parallel strategy marks multiple steps for concurrent execution:

```
TeamCreate(team_name: "<feature>-work")
```

Discover developer agents: check `agents.developers` in pipeline.yml first. If not configured (default), discover all available agents (project, plugins, global) and select those whose description indicates a developer role. For each developer agent:

```
Agent(subagent_type: "<dev-agent>", name: "<dev-agent>",
      team_name: "<team>", run_in_background: true,
      prompt: "Execute Step N. Follow Team Communication Protocol.
               Strict TDD: write test → red → implement → green.
               Teammates: [other devs], qa.
               SendMessage to qa for review when done.
               If shared contracts change → SendMessage to other devs.")
```

Always include a QA agent:

```
Agent(subagent_type: "qa", name: "qa",
      team_name: "<team>", run_in_background: true,
      prompt: "Wait for developer notification, then review.
               Follow Team Communication Protocol.
               Teammates: [dev agents].
               Review per checklist + call Codex CLI for cross-family review.
               Send findings to dev, wait for fixes, re-review.
               Pass → SendMessage to dev confirming.")
```

If no developer agents found (neither in pipeline.yml nor any agent source), Lead executes directly (no teams).

## Contract Extraction

Before starting the TDD cycle, extract a contract from the current plan step:

1. Parse the current step's text in the plan file:
   - **`files_allowed`**: extract from "Expected files:" line (comma-separated paths). If no such line exists → `is_empty = true`
   - **`target_ac`**: extract from step title, e.g. "(AC1, AC2)" → `["AC1", "AC2"]`
2. If extraction fails (plan structure unrecognizable) → show warning, set `is_empty = true`, continue
3. Display contract silently (do NOT block for confirmation):
   ```
   📋 Contract: files_allowed=[src/auth/middleware.ts, src/auth/types.ts], AC=[AC3]
   ```
   If `is_empty`: `📋 Contract: empty (no Expected files in plan — drift verification skipped)`

## TDD Cycle (all modes)

If `test.command` is empty → skip TDD cycle, implement directly.

If `test.command` is set:
1. **Write test** — based on step's AC, write a failing test
2. **Confirm red** — run test, confirm failure (passes → test too loose, fix)
3. **Cross-family testgen** — use Codex to suggest edge cases
4. **Synthesize test ideas** — merge Claude + cross-family test suggestions
5. **Implement** — write minimum code to pass tests
6. **Confirm green** — run tests, all pass
7. **Refactor** (if needed)

Complex steps → multiple TDD rounds (one per subtask).

### Fix Loop Circuit Breaker

Track consecutive failures per test file during TDD. If the same test file fails N consecutive times (default: 3, configurable via `pipeline.yml` → `work.max_fix_loops`):

→ **STOP** and show:
```
🔴 Fix loop detected: [test file] failed [N] consecutive times.

Options:
1. Retry with a different approach (describe what to try differently)
2. Skip this subtask and defer to next step
3. Pause for human help
```

Do NOT continue the TDD cycle. Each option must be presented to the user via AskUserQuestion.

## Pre-commit Checks (every commit must pass all)

0. **Diff transparency** — run `git diff --stat` and display the output. This shows the user exactly which files were changed and how much, enabling quick drift detection before commit.
1. **Contract verification** — if `contract.is_empty == false`:
   - Run `git diff --name-only` to get the list of changed files
   - Compare against `contract.files_allowed`
   - Any file outside `files_allowed` → **contract violation**:
     ```
     ⚠️ Contract violation detected:
     - files_allowed: [list from contract]
     - actual changes: [list from git diff]
     - unexpected: [files not in contract]

     Options:
     1. Fix: revert unexpected changes and retry
     2. Approve drift: explain why this change is necessary (recorded in commit message)
     3. Rollback: discard this step's changes entirely
     ```
   - If `contract.is_empty == true` → skip verification, treat as passed
2. **Tests green** — run the test command from pipeline.yml. If empty → skip, show "⚠️ No test command configured, skipping tests"
3. **Code Review** — execute `/ae:code-review` (subagent mode, fast)
4. **Disposition table** — classify all findings with default handling:
   - **P1 (blocker)**: always show, always fix now
   - **P2 logic/security**: show, require human disposition (fix now / defer / backlog)
   - **P2 style/naming**: auto-skip (do not show unless user requests full report)
   - **P3 (minor)**: auto-skip (do not show unless user requests full report)
   - Defer → write to `<output.milestones>/*/notes.md`
   - Backlog → write to `pipeline.yml` → `output.backlog` (default: `docs/backlog/`). File: `BL-NNN-slug.md` with frontmatter `id`, `title`, `type: backlog`, `created`, `status: open`
5. **Disposition challenge** — send P1 + P2-logic/security items to cross-family for challenge (skip P2-style and P3)
6. **Fix and re-review** — after fixing findings, re-run review until clean pass

## Commit

- One step = one commit (can split if too large, but each must be independent logic unit)
- After commit, immediately update plan: `- [ ]` → `- [x]` with commit hash

## Post-commit

1. Brief summary: what was done, key decisions, structural changes
2. **Auto-pass gate** — check `pipeline.yml → work.auto_pass`:
   - If `auto_pass: false` (default) → **Pause, wait for user confirmation** (current behavior)
   - If `auto_pass: true` → evaluate gate conditions:
     - tests green (step 2 of pre-commit passed) ✅
     - code-review no P1 findings ✅
     - contract verified (no violation, or contract.is_empty) ✅
     - changed files do NOT match any `work.security_patterns` ✅
     - **All conditions met** → auto-continue:
       ```
       ✅ Auto-pass: tests green, no P1, contract verified. Continuing to Step N+1.
       ```
     - **Any condition not met** → pause for user confirmation
     - **Contract violation** → always pause (highest priority, regardless of auto_pass)
     - **Security pattern match** → always pause (e.g., auth/*, *.env, *secret*)
3. All steps done → suggest `/ae:review`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit
