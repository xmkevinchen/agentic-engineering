---
name: ae:work
description: Execute plan (TDD + commit + review, pre-checks chain)
argument-hint: "<plan file path>"
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with `status: reviewed` and uncompleted steps (`- [ ]`)
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

### Check 1: Plan Exists & Reviewed
- Read the plan file, confirm it contains `## Acceptance Criteria` or `## AC`
- If missing → suggest `/ae:plan`, **refuse to execute**
- Read plan frontmatter `status`:
  - `status: reviewed` → proceed
  - `status: draft` or missing → **refuse to execute**:
    ```
    Plan is unreviewed (status: draft). Run `/ae:plan-review <plan-path>` first.
    ```
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
1. Run `/ae:test-plugin --regression --layer1` targeting the changed skills/agents (Layer 1 static analysis only — do NOT execute Layer 2 during pre-commit)
2. **Layer 1 failure = P1** (blocks commit via auto-pass gate, same as other P1 findings)

If no plugin files in diff → skip with "No plugin skill/agent files changed, skipping protocol check."

### D. Code Review
Read `work.review_mode` from pipeline.yml (default: `full`). Override with `--light` or `--full` flag if passed.
- **full**: Lead executes `/ae:code-review` inline with all 4 tracks (Claude + Codex + Gemini + Doodlestein)
- **light**: Lead executes `/ae:code-review` inline with Track 1 only (Claude review, skip cross-family and Doodlestein)

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

2. **Accumulated Doodlestein Checkpoint** (before gate)

   **Skip if** `pipeline.yml → work.accumulated_doodlestein: false`. Initialize `no_accumulated_p1 = true`.

   After commit, compute from plan file:
   - `total_steps` = count all `### Step N` headings
   - `current_step` = count all completed steps (`- [x]` checkboxes at step level)

   **Trigger condition**: `(total_steps >= 3 AND current_step == total_steps)` OR `(total_steps > 5 AND current_step == floor(total_steps/2))`

   For plans with >5 steps, checkpoint runs **twice**: at midpoint and at final step. This is intentional — midpoint catches early drift, final step catches late drift.

   When triggered:
   1. Spawn Codex proxy (primary) + Gemini proxy (optional, if enabled) with Doodlestein prompt on `git diff main...HEAD` (accumulated feature diff):
      ```
      Agent(subagent_type: "codex-proxy", run_in_background: true,
            prompt: "You are a Doodlestein adversarial reviewer performing an accumulated review.
                     Analyze the full feature diff (git diff main...HEAD).
                     Answer 3 questions concisely (1-3 sentences each, cite file:line evidence):
                     1. STRATEGIC: What is the single smartest improvement across all these changes?
                     2. ADVERSARIAL: What cross-commit mistake or blind spot exists?
                     3. REGRET: Which decision across these commits is most likely to be reversed?
                     If a question has no substantive concern, say 'No concern.' Do not force issues.
                     SendMessage findings to Lead (TL).")
      ```
   2. Collect findings. Classify: P1 (critical blind spot) / P2 (concern) / P3 (minor)
   3. Write findings to `<output.milestones>/*/notes.md`
   4. P1 findings set `no_accumulated_p1 = false`

   If not triggered (step count doesn't match condition) → skip silently, `no_accumulated_p1` stays `true`.

3. **Auto-pass gate** (default: ON) — evaluate after every step:
   ```
   gate = tests_green AND no_p1 AND no_accumulated_p1 AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)
   ```
   `no_accumulated_p1` defaults to `true`. Set to `false` only when accumulated checkpoint runs and finds P1.
   - All met → auto-continue: `✅ Auto-pass: tests green, no P1, no accumulated P1, no drift, review complete. Continuing to Step N+1.`
   - Any failed → **pause for user confirmation**
   - Drift detected (not approved) → always pause
   - Security pattern matched → always pause
   - No test command → `tests_green` = UNVERIFIED — **pause for user confirmation** (do not treat as true)
   - No "Expected files:" in plan step → `drift` = UNKNOWN — **pause for user confirmation** (do not skip)
   - `cross_family_degraded` = true (all cross-family failed after fallback, reported by code-review as `cross_family_degraded`) → **pause**:
     ```
     ⚠️ Review ran in degraded mode (cross-family unavailable after fallback). Auto-pass blocked.
     Options:
     1. Accept Claude-only review and continue
     2. Retry (proxies may recover)
     ```
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
