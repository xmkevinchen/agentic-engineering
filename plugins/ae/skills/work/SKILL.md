---
name: ae:work
description: Execute plan (TDD + commit + review, pre-checks chain). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
effort: high
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with `status: reviewed` and uncompleted steps (`- [ ]`)
2. Found → use that plan file path
3. Not found → check conversation context for a plan being discussed
4. Still nothing → ask user which plan to execute

**Tiebreaker rule**: when multiple plans match, select the most recent plan with `status: reviewed` and uncompleted steps (by plan ID/creation order, not file mtime). `/ae:next` uses the same rule to ensure consistent suggestions.

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
  - `status: reviewed` or `status: done` → proceed (`done` plans may have remaining unchecked steps from partial execution)
  - `status: draft` → **refuse to execute**:
    ```
    Plan is unreviewed (status: draft). Run `/ae:plan-review <plan-path>` first.
    ```
  - Any other value → **refuse to execute**:
    ```
    Unknown plan status '<value>'. Valid values: draft | reviewed | done | cancelled.
    Fix the plan frontmatter before executing.
    ```
- **Self-healing**: read plan frontmatter `discussion:` field. If non-empty:
  - Read that discussion's `index.md` → check `plan:` field
  - If `plan:` is empty or `""` → patch: set `plan: "<this-plan-path>"`, log `[HEALED] Updated discussion plan: field → <this-plan-path>`
  - If `plan:` points to a DIFFERENT plan → log `[WARNING] Discussion plan: field points to <other-plan>, not this plan. Not auto-patching (ambiguous).` Continue without patching.
  - If `plan:` already correct → no action
- Scan all pending steps (`- [ ]`): if any step lacks an "Expected files:" line → warn:
  ```
  ⚠️ Steps N, M missing "Expected files:" — these steps will hard-stop at Check B (requires manual confirmation or plan update).
  ```

### Check 2: Locate Current Step
- `- [x]` = done, `- [ ]` = pending. Current step = first pending.
- All done → suggest `/ae:review`, **refuse to execute**

#### Step-Summary Context

Read `<output.milestones>/<milestone>/step-summaries.md` if it exists. Extract the last 3 complete step blocks (identified by `## Step N` headers), or all blocks if fewer than 3 exist. If the file doesn't exist → skip silently (no error, no warning — this is normal for step 1 or first-time execution).

TL reviews these blocks internally for planning context only — understanding what decisions were made, what was rejected, and what cross-step dependencies exist before planning the current step's execution. Do NOT inject these blocks into agent spawn prompts. Injection is handled separately by the overlap heuristic below.

#### Context Overlap Heuristic

Compare the **immediately preceding step's** `Actual files:` list (from the last block in step-summaries.md) with the **current step's** `Expected files:` line (from the plan):

- **Any shared file** → inject the immediately preceding step's summary block (1 block only, not all loaded blocks) into the **developer agent** spawn prompt as a `Prior step context:` header. QA agent does NOT receive injection (QA evaluates with fresh eyes).
- **No overlap** → fresh spawn, no injection.
- **No previous step summary** (step 1, cold start, or missing `Actual files:` field) → skip injection silently, no error.

### Check 3: Agent Teams
1. Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set
   - Not set → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo.` and proceed with Lead executing TDD cycle directly (same as "No developer agents found" path). Cross-family and parallel review disabled.
2. If set → call `ToolSearch("select:Agent")` to verify Agent tool schema includes `run_in_background` parameter:
   - Schema returned WITH `run_in_background` param → `AGENT_TEAMS_FULL = true`
   - Schema returned WITHOUT `run_in_background` → `AGENT_TEAMS_FULL = false`, degrade per tier table (same as auto-fallback)
   - No results returned (Agent already loaded as first-class tool) → `AGENT_TEAMS_FULL = true`
   - ToolSearch call fails/times out → `AGENT_TEAMS_FULL = true` (fail-open), log: `[WARNING] ToolSearch unavailable, assuming full Agent Teams support`
3. Cache `AGENT_TEAMS_FULL` for this entire ae:work invocation (all steps). Do not repeat ToolSearch per step.

### Check 4: Deferred Items
Read `<output.milestones>/<plan-id>/notes.md` (plan-id = plan frontmatter `id:`). If file doesn't exist → skip: `✅ Deferred items: none`

Parse lines matching `DEFERRED [Step N]:` where N = current step number. If matches found, display each and require TL to write a disposition before proceeding:

- **FIXED** — finding addressed in this step's implementation. Append `Disposition: FIXED` line to the entry in notes.md.
- **STILL-DEFERRED [Step M]** — re-queue to step M. Replace `[Step N]` with `[Step M]` in the DEFERRED line only (not Reason: line). If Step M > total plan steps → must use backlog instead.
- **WAIVED: \<reason\>** — accepted as-is. Append `Disposition: WAIVED: <reason>` line to the entry in notes.md.

All dispositions MUST be written to notes.md (not just in conversation). ae:review Check 4 reads these to classify resolution.

No matches → `✅ Deferred items: none`

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
      prompt: "[If overlap heuristic triggered] Prior step context: <previous step summary block>
               Execute Step N. Strict TDD: write test → red → implement → green.
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
- **Defer** — MUST write structured entry to `<output.milestones>/<plan-id>/notes.md` (plan-id = plan frontmatter `id:`; create directory and file if needed). Format:
    ```
    DEFERRED [Step N]: <one-line finding description>
    Reason: <why deferred, what will resolve it>
    ```
    `[Step N]` = target step where this must be addressed (REQUIRED). If no target step can be identified → use backlog (`BL-NNN` in `output.backlog`), not defer. This write is mandatory — defer without writing to notes.md is a protocol violation.
- Backlog → `BL-NNN-slug.md` in `output.backlog`

### F. Disposition Challenge
Send P1 + P2-logic/security to cross-family for challenge.

### G. Fix & Re-review
Fix findings, re-run from Check D until clean pass.

## Commit

- One step = one commit (split if too large, each must be independent)
- After commit, update plan: `- [ ]` → `- [x]` with commit hash

## Post-commit

1. **Step Summary** — persist to disk AND echo in conversation.

   Write a step-summary block to `<output.milestones>/<milestone>/step-summaries.md` (create directory and file if they don't exist). Append one block per completed step:

   ```
   ## Step N — <step title> (commit: <hash from git rev-parse HEAD>)
   **Decisions**: [key choices made, with rationale — 1-3 bullets]
   **Rejected**: [alternatives considered but dropped, why]
   **Cross-step deps**: [files/contracts this step created that later steps depend on]
   **Actual files**: [comma-separated list from git diff --name-only, already available from Check B]
   ```

   The `Actual files:` field copies the file list from Check B's drift detection output — no re-computation needed. This field is consumed by the context overlap heuristic (see Check 2) to determine whether to inject prior step context into agent spawn prompts.

   Also echo the summary content in conversation (replacing the previous ephemeral "Brief summary" behavior).

2. **Accumulated Doodlestein Checkpoint** (before gate)

   **Skip if** `pipeline.yml → work.accumulated_doodlestein: false` OR `AGENT_TEAMS_FULL = false` (run_in_background unavailable — log: `[Doodlestein checkpoint skipped: run_in_background unavailable]`). Initialize `no_accumulated_p1 = true`.

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
                     SendMessage findings to team-lead.")
      ```
   2. Collect findings. Classify: P1 (critical blind spot) / P2 (concern) / P3 (minor)
   3. Write findings to `<output.milestones>/<plan-id>/notes.md` using `CHECKPOINT:` prefix (not `DEFERRED` — avoids triggering Check 4 parsing)
   4. P1 findings set `no_accumulated_p1 = false`

   If not triggered (step count doesn't match condition) → skip silently, `no_accumulated_p1` stays `true`.

3. **Auto-pass gate** (default: ON) — evaluate after every step:
   ```
   gate = tests_green AND no_p1 AND no_accumulated_p1 AND deferred_resolved AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)
   ```
   `no_accumulated_p1` defaults to `true`. Set to `false` only when accumulated checkpoint runs and finds P1.
   `deferred_resolved` defaults to `true`. Set to `false` when Check 4 found DEFERRED items matching current step but TL did not write dispositions for all of them.
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
3. All steps done → run Completion Invariant, then `All steps complete. Next: /ae:review <plan-file-path>`

## Completion Invariant

When all plan steps are `[x]`, write pipeline state before suggesting next steps:

- [ ] Do NOT update plan `status` — leave as `reviewed`. ae:review will set `status: done` after verdict. This preserves the work → review handoff (ae:review argument inference filters `status: done`).
- [ ] Read plan `discussion:` field. If non-empty → read that discussion's `index.md`:
  - Set `pipeline.work: done` (note: not read by dashboard/next, but documents completion)
  - Log: `[WRITEBACK] Discussion pipeline.work → done`
- [ ] If `discussion:` is empty → log: `[WRITEBACK] All steps complete (standalone plan)`

## Output

- Implementation code + tests
- Plan checkbox updates
- Review records for each commit

## Next Steps

Based on work completion, suggest with exact executable command:
- If all plan steps completed → `Pipeline state updated. All steps complete. Next: /ae:review <plan-file-path>`
- If steps remain → auto-continue to next step (or pause if gate failed)
- If blockers encountered → `Blocker on Step N. Try: /ae:think <blocker description>`
