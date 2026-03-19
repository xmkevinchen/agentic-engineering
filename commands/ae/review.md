---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate)
argument-hint: "<plan file path>"
---

# /ae:review — Deep Review (Feature Completion Gate)

Deep review of all changes for **$ARGUMENTS**.

## Pre-checks (all must pass before starting)

### Check 1: Plan All Done
- Read the plan file
- Confirm all step checkboxes are `- [x]`
- If pending → suggest `/ae:work`, **refuse to execute**

### Check 2: Tests Green
- Run the test command from pipeline.yml
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

### 3. Launch 4 Teammates in Parallel

In **one message** launch all (`run_in_background: true`):

```
Agent(subagent_type: "security-reviewer", name: "security-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> for security. Follow Team Communication Protocol.
               Teammates: performance-reviewer, architecture-reviewer, challenger.
               SendMessage findings to challenger when done. Cross-domain findings → send to relevant reviewer.")

Agent(subagent_type: "performance-reviewer", name: "performance-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> for performance. Follow Team Communication Protocol.
               Teammates: security-reviewer, architecture-reviewer, challenger.
               SendMessage findings to challenger when done. Cross-domain findings → send to relevant reviewer.")

Agent(subagent_type: "architecture-reviewer", name: "architecture-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Review <diff-range> for architecture. Follow Team Communication Protocol.
               Teammates: security-reviewer, performance-reviewer, challenger.
               SendMessage findings to challenger when done. Cross-domain findings → send to relevant reviewer.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Operate in /review mode per Team Communication Protocol.
               Review scope: <diff-range>.
               Step 1: parallel launch — independent review + Codex independent review + Gemini independent review.
               Step 2: wait for all 3 reviewer findings, then compare and merge.
               Step 3: targeted challenges. Step 4: synthesize final report and send to Lead.")
```

**No worktree isolation** — teammates need SendMessage communication.

### 4. Wait for Final Report

Challenger collects findings → calls cross-family → challenges → synthesizes → SendMessage to Lead.

If challenger idle > 5 minutes without sending report, SendMessage to prompt.

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
GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash main
```

### 4. Verify

Re-run test command from pipeline.yml, confirm tests pass.

### 5. Remaining Findings Disposition

P2/P3 per standard rule (fix / defer / backlog).

## Output

1. Challenger final report (with discussion evidence, cross-family opinions, disposition recommendations)
2. Fixups squashed
3. Deferred items written to notes.md, backlog items to docs/backlog/
4. Prompt user to create PR
