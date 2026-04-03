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
- Scan all pending steps (`- [ ]`): if any step lacks an "Expected files:" line → warn:
  ```
  ⚠️ Steps N, M missing "Expected files:" — these steps will hard-stop at Check B (requires manual confirmation or plan update).
  ```

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
- **No "Expected files:" in plan** → drift = UNKNOWN → **hard stop**:
  ```
  🛑 No Expected files in plan step — drift = UNKNOWN. Hard stop.
     Auto-pass blocked. Options:
     1. Add Expected files to the plan step, then re-run Check B
     2. Confirm to continue (drift recorded as 'unknown' in Outcome Statistics)
     3. Rollback this step's changes
  ```

### C. Tests Green
Run `test.command` from pipeline.yml. Empty → skip with "⚠️ No test command configured".

### C.5 Protocol Invariant Check
If `git diff --name-only` includes files under `plugins/ae/skills/` or `plugins/ae/agents/`:
1. Read all test case files in `plugins/ae/tests/` with `layer: 1` in frontmatter
2. For each Layer 1 test case, execute static analysis: read target SKILL.md files, check MUST/MUST_NOT/SHOULD assertions against file content
3. **Layer 1 failure = P1** (blocks commit via auto-pass gate, same as other P1 findings)
4. Report results:
   - All pass → `✅ Protocol invariant check: N/N Layer 1 cases pass`
   - Any fail → `P1: Protocol invariant violation — [case id]: [failed assertion]`

If no plugin files in diff → skip with "No plugin skill/agent files changed, skipping protocol check."

### D. Code Review
Read `work.review_mode` from pipeline.yml (default: `full`). Override with `--light` or `--full` flag if passed.
- **full**: Lead executes `/ae:code-review` inline with all 3 tracks (Claude + Codex + Gemini)
- **light**: Lead executes `/ae:code-review` inline with Track 1 only (Claude review, skip cross-family)

Read the code-review SKILL.md and follow its instructions within the current context, passing the mode.

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
   - No "Expected files:" in plan step → blocked at Check B (hard stop), will not reach gate
   - UNVERIFIED states block the gate — they are not true values
   - User can disable auto-pass in `pipeline.yml` → `work.auto_pass: false` if they prefer manual confirmation every step
3. All steps done → `All steps complete. Next: /ae:review <plan-file-path>`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit

## Next Steps

Based on work completion, suggest with exact executable command:
- If all plan steps completed → `All steps complete. Next: /ae:review <plan-file-path>`
- If steps remain → auto-continue to next step (or pause if gate failed)
- If blockers encountered → `Blocker on Step N. Try: /ae:think <blocker description>`
