---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate)
argument-hint: "<plan file path>"
user-invocable: true
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with all steps completed (`- [x]`) and `status` not `done`
2. Found → use that plan file path
3. Not found → ask user which plan to review

# /ae:review — Deep Review (Feature Completion Gate)

Deep review of all changes for **$ARGUMENTS**.

## Pre-checks (all must pass before starting)

### Check 1: Agent Teams
- Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set
- If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

### Check 2: Plan All Done
- Read the plan file
- Confirm all step checkboxes are `- [x]`
- If pending → suggest `/ae:work`, **refuse to execute**

### Check 2: Tests Green
- Run the test command from pipeline.yml. If empty → skip, show "⚠️ No test command configured, skipping tests"
- If fail → fix first, **refuse to execute**

## Execution: Agent Teams Review

**Review scope**: determine base commit (feature branch: `git diff main...HEAD`, main branch: `git diff <feature-start>..HEAD`).

### 1. Create Team

```
TeamCreate(team_name: "<feature>-review")
```

### 2. Create Tasks

```
TaskCreate("Security review")
TaskCreate("Performance review")
TaskCreate("Architecture review")
TaskCreate("Cross-family challenge + synthesis")
```

### 3. Select and Launch Reviewers

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. Analyze `git diff --stat` to determine which context signals match. Select 2-4 reviewers. Always include **challenger** (pure opposition).

**Cross-family**: Read `cross_family` from pipeline.yml. Follow the cross-family rules in the **Agent Selection Reference** skill — same specialized prompt for both proxies. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

**Launch all in one message** (`run_in_background: true`):

```
# For each selected reviewer:
Agent(subagent_type: "<reviewer>", name: "<reviewer>",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> for <your domain>. Follow Team Communication Protocol.
               Teammates: [other selected reviewers], challenger.
               SendMessage findings to team-lead when done.")

# Always include challenger (pure opposition — does NOT synthesize):
Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Operate in /review mode per Team Communication Protocol.
               Review scope: <diff-range>.
               Teammates: [selected reviewers], codex-proxy, gemini-proxy.
               Step 1: independent review of blind spots.
               Step 2: targeted challenges with structured format (Claim/Evidence/Objection/Confidence).
               SendMessage challenges to team-lead when done.
               You are pure opposition. Do NOT synthesize — TL synthesizes.")

# Cross-family (same specialized prompt for both):
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> via Codex MCP. <specialized focus based on diff context>.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> via Gemini MCP. <same specialized focus as codex>.
               SendMessage findings to team-lead when done.")
```

**No worktree isolation** — teammates need SendMessage communication.

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference — proxy 120s MCP timeout + 120s wait timeout.

### 4. TL Synthesizes Final Report

TL collects all findings from reviewers + challenger + cross-family proxies, then synthesizes:
- Merge overlapping findings, resolve contradictions
- Produce Disagreement Value Assessment where reviewers disagreed
- Classify by severity (P1/P2/P3)

If any agent idle > 5 minutes without sending findings, SendMessage to prompt.

### 5. Close Team

After report arrives, send shutdown_request to all teammates.

## Result Processing

### Severity Levels
- **P1** — security vulnerabilities, data loss, crashes
- **P2** — performance, maintainability, architecture issues
- **P3** — minor improvements

## Fixup Flow

### 1. Build Mapping Table

```
| Finding       | Commit (step)           | Fix              |
|---------------|-------------------------|------------------|
| Missing guard | abc123 (step 2: repo)   | Add null check   |
| Unused import | def456 (step 4: screen) | Remove           |
```

Group by commit. Check for dependencies between findings.

### 2. Fixup Commits

One fixup per original commit (not per finding):

```bash
git commit --fixup=abc123
git commit --fixup=def456
```

### 3. Squash

```bash
git rebase --autosquash main
```

### 4. Verify

Re-run test command from pipeline.yml, confirm tests pass.

### 5. Remaining Findings Disposition

P2/P3 per standard rule (fix / defer / backlog).

### Fixup Loop Limit

Track consecutive fixup rounds. Read `work.max_fix_loops` from pipeline.yml (default: 3). If the same finding persists after that many fixup rounds:

```
🔴 Fixup loop limit reached: 3 rounds of fixup without resolution.

Options:
1. Fix manually — pause for human intervention
2. Defer to backlog — write to output.backlog as BL-NNN-slug.md
3. Accept as-is — record finding as known issue in review report
```

Do NOT continue fixup indefinitely.

## Outcome Statistics

After all fixups are done, compile outcome data for this feature cycle:

```
## Outcome Statistics
- Steps completed: N/M
- Rework rate: X steps needed fixup commits (X/N = Y%)
- P1 escape rate: Z P1 findings discovered in /ae:review (should be 0 if /ae:work pre-commit caught them all)
- Drift events: D contract violations during /ae:work (approved: A, fixed: F, rolled back: R, unknown: U)
- Fix loop triggers: N circuit breaker activations during /ae:work (same test file failed max_fix_loops times)
- Auto-pass rate: P steps auto-continued / N total steps (only if auto_pass was enabled)
```

Include this in the review report. This data accumulates naturally across features, providing evidence for tuning checklists and gate conditions over time.

## Output

Write the review report to `pipeline.yml` → `output.reviews`. Review file frontmatter must include:

```yaml
---
id: "NNN"
title: "Review: <feature>"
type: review
created: YYYY-MM-DD
target: "<path-to-plan-file>"
verdict: pass    # or: fail
---
```

The `verdict` field is required — it enables `/ae:dashboard` and `/ae:next` to determine review completion without reading file content.

Report contents:
1. TL synthesis report (merged findings from all reviewers + challenger + cross-family, with Disagreement Value Assessment and severity classification)
2. Outcome statistics (rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate)
3. Fixups squashed
4. Deferred items written to `pipeline.yml` → `output.milestones` (default: `docs/milestones/`) `*/notes.md`, backlog items to `pipeline.yml` → `output.backlog` (default: `docs/backlog/`)
5. Prompt user to create PR

## Next Steps

Based on review outcome, suggest with exact executable command:
- If review passed → `Review passed.` Suggest next action based on project's source control workflow and context. Let user decide.
- If review has P1 findings → `P1 findings remain. Fix and re-run /ae:review <plan-file-path>`
- If review deferred items → `Deferred items exist. Address in next iteration or /ae:plan for follow-up.`
