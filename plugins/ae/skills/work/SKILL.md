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

### Check 3: Deferred Items
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

## Pre-commit Checks (every commit must pass all)

1. **Tests green** — run the test command from pipeline.yml. If empty → skip, show "⚠️ No test command configured, skipping tests"
2. **Code Review** — execute `/ae:code-review` (subagent mode, fast)
3. **Disposition table** — classify all findings:
   - Fix now (< 5 min, fix immediately)
   - Defer to step N (write to `<output.milestones>/*/notes.md`)
   - Backlog (write to `pipeline.yml` → `output.backlog`, default: `docs/backlog/`). File: `BL-NNN-slug.md` with frontmatter `id`, `title`, `type: backlog`, `created`, `status: open`
4. **Disposition challenge** — send table to cross-family for challenge
5. **Fix and re-review** — after fixing findings, re-run review until clean pass

## Commit

- One step = one commit (can split if too large, but each must be independent logic unit)
- After commit, immediately update plan: `- [ ]` → `- [x]` with commit hash

## Post-commit

1. Brief summary: what was done, key decisions, structural changes
2. **Pause, wait for user confirmation before continuing to next step**
3. All steps done → suggest `/ae:review`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit
