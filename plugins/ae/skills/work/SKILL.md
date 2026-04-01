---
name: ae:work
description: Execute plan (TDD + commit + review, pre-checks chain)
argument-hint: "<plan file path>"
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with `status: draft` or `status: reviewed` and uncompleted steps (`- [ ]`)
2. Found → use that plan file path
3. Not found → check conversation context for a plan being discussed
4. Still nothing → ask user which plan to execute

# /ae:work — Execute Plan

Execute the plan at **$ARGUMENTS**.

## Execution Flow

```
Pre-checks → Locate step → [Agent Teams?] → TDD cycle → Pre-commit → Commit → Auto-pass gate
                                                              ↑                       │
                                                              └── fix & re-review ────┘
```

## Pre-checks (all must pass)

### Check 1: Plan Exists
- Read the plan file, confirm it contains `## Acceptance Criteria` or `## AC`
- If missing → suggest `/ae:plan`, **refuse to execute**

### Check 2: Locate Current Step
- `- [x]` = done, `- [ ]` = pending. Current step = first pending.
- All done → suggest `/ae:review`, **refuse to execute**

### Check 3: Agent Teams
- Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`
- If not enabled → **refuse to execute** with instructions to enable

### Check 4: Deferred Items
- Check `<output.milestones>/*/notes.md` for items tagged to current step
- Has unresolved → list and resolve before continuing

```
Pre-checks:
✅ Plan exists: docs/plans/003-feature.md
✅ Current step: Step 3 (Steps 1-2 done)
✅ Deferred items: none
```

## Execution Mode Selection

**Single-platform step** → Lead executes TDD cycle directly.

**Parallel steps** → Agent Teams:

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

```
TeamCreate(team_name: "<feature>-work")

Agent(subagent_type: "<dev-agent>", name: "<dev-agent>",
      team_name: "<team>", run_in_background: true,
      prompt: "Execute Step N. Strict TDD: write test → red → implement → green.
               Teammates: [other devs], qa.
               SendMessage to qa when done.")

Agent(subagent_type: "qa", name: "qa",
      team_name: "<team>", run_in_background: true,
      prompt: "Wait for dev, then review per checklist + cross-family — <specialized focus based on context>.
               Send findings to dev, wait for fixes, re-review.
               Pass → SendMessage to dev confirming.")
```

No developer agents found → Lead executes directly.

## TDD Cycle

If `test.command` is empty → skip TDD, implement directly.

If `test.command` is set:
1. **Write test** — based on step's AC
2. **Confirm red** — test fails (passes → test too loose, fix)
3. **Cross-family testgen** — Codex suggests edge cases
4. **Synthesize** — merge Claude + cross-family test ideas
5. **Implement** — minimum code to pass tests
6. **Confirm green** — all tests pass
7. **Refactor** (if needed)

Complex steps → multiple TDD rounds (one per subtask).

### Fix Loop Circuit Breaker

Track consecutive failures per test file. Same test file fails N times (default: 3, configurable via `pipeline.yml` → `work.max_fix_loops`):

```
🔴 Fix loop detected: [test file] failed [N] consecutive times.

Options:
1. Retry with a different approach
2. Skip this subtask and defer
3. Pause for human help
```

## Pre-commit Checks

### A. Diff Transparency
Run `git diff --stat` and display output.

### B. Drift Check
Read the current plan step's "Expected files:" line:
- **Has "Expected files:"** → run `git diff --name-only`, compare:
  - All files in expected list → ✅ pass
  - Files outside expected list → ⚠️ drift detected:
    ```
    ⚠️ Drift detected:
    - Expected: [files from plan]
    - Actual: [files from git diff]
    - Unexpected: [difference]

    Options:
    1. Fix: revert unexpected changes and retry
    2. Approve drift: explain why (recorded in commit message)
    3. Rollback: discard this step's changes
    ```
    If unexpected files match `pipeline.yml` → `work.security_patterns` → option 2 unavailable, must fix or get human review.
- **No "Expected files:" in plan** → drift = UNKNOWN:
  ```
  ⚠️ No Expected files in plan step — drift = UNKNOWN.
     Gate will pause for user confirmation. Consider running /ae:plan to add file lists.
  ```

### C. Tests Green
Run `test.command` from pipeline.yml. Empty → skip with "⚠️ No test command configured".

### D. Code Review
Execute `/ae:code-review` (subagent mode, fast).

### E. Disposition
- **P1 (blocker)**: always show, fix now
- **P2 logic/security**: show, human disposition (fix / defer / backlog)
- **P2 style/naming**: auto-skip
- **P3 (minor)**: auto-skip
- Defer → write to `<output.milestones>/*/notes.md`
- Backlog → `BL-NNN-slug.md` in `output.backlog`

### F. Disposition Challenge
Send P1 + P2-logic/security to cross-family for challenge.

### G. Fix & Re-review
Fix findings, re-run from Check D until clean pass.

## Commit

- One step = one commit (split if too large, each must be independent)
- After commit, update plan: `- [ ]` → `- [x]` with commit hash

## Post-commit

1. Brief summary: what was done, key decisions, structural changes
2. **Auto-pass gate** (default: ON) — evaluate after every step:
   ```
   gate = tests_green AND no_p1 AND (no_drift OR drift_approved)
   ```
   - All met → auto-continue: `✅ Auto-pass: tests green, no P1, no drift. Continuing to Step N+1.`
   - Any failed → **pause for user confirmation**
   - Drift detected (not approved) → always pause
   - Security pattern matched → always pause
   - No test command → `tests_green` = UNVERIFIED — **pause for user confirmation** (do not treat as true)
   - No "Expected files:" in plan step → `drift` = UNKNOWN — **pause for user confirmation** (do not skip)
   - UNVERIFIED or UNKNOWN states block the gate — they are not true values
   - User can disable auto-pass in `pipeline.yml` → `work.auto_pass: false` if they prefer manual confirmation every step
3. All steps done → suggest `/ae:review`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit
