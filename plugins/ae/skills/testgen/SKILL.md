---
name: ae:testgen
description: Generate comprehensive test suites with edge case coverage for specific code
argument-hint: "<file, function, or module to test>"
user-invocable: true
effort: medium
---

# /ae:testgen — Test Generation

Generate tests for: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:testgen creates exactly **4 tasks** per invocation (1 Pre-check + Analyze + Review + Generate-and-Verify).

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:testgen: Pre-check` | At skill start | Immediately before pre-check 1 | After pre-checks pass (control reaches Step 1 Analyze) |
| `ae:testgen: Analyze (Step 1)` | At skill start (batch) | When TL begins analyzing target for test gaps | When analysis output ready for Review |
| `ae:testgen: Review (qa + security-reviewer + proxy)` | At skill start (batch) | When the first reviewer agent (qa / security-reviewer / cross-family proxy) is spawned in Step 2 | When all spawned reviewers have returned findings at TL |
| `ae:testgen: Generate + Verify (Steps 3+4)` | At skill start (batch) | When TL begins synthesizing test code | When generated tests are verified (or marked failing per Verify outcome) |

At skill start, batch-create:

```
TaskCreate(subject: "ae:testgen: Pre-check")
TaskCreate(subject: "ae:testgen: Analyze (Step 1)")
TaskCreate(subject: "ae:testgen: Review (qa + security-reviewer + proxy)")
TaskCreate(subject: "ae:testgen: Generate + Verify (Steps 3+4)")
```

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:testgen: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After pre-checks pass, call `TaskUpdate(taskId, status: "completed")`.
Same lifecycle applies to Analyze, Review, and Generate+Verify phase tasks — `TaskUpdate(taskId, status: "in_progress")` when the phase begins, `TaskUpdate(taskId, status: "completed")` when the phase's completion criterion is met.

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Run `check-agent-teams.sh` (exit 0 = available; exit 1 = unavailable, prints the reason). If exit 1 → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL executing directly (no team spawn).
3. Read `test.command` and `test.framework` from pipeline.yml

## Step 1: Analyze

1. Read the target code thoroughly
2. Map code paths: happy path, error paths, edge cases
3. Identify boundary conditions, null/empty inputs, type coercions
4. Check existing tests for patterns and conventions
5. Note dependencies that need mocking

## Step 2: Agent Teams Review

Spawn teammates for parallel test planning review (Investigation Mode). **TL validates coverage**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents.

```
Agent(subagent_type: "qa", name: "qa",
      run_in_background: true,
      prompt: "📋 Cast: qa
                  Role: test plan completeness reviewer
                  Angle: code path coverage + edge cases + error handling
                  Why: primary completeness check for test design

               Review this test plan for completeness: <target code summary + proposed test cases>.
               Follow Team Communication Protocol.
               Teammates: security-reviewer, <enabled proxies>.
               Check: all code paths covered? Edge cases? Error handling?
               Missing scenarios → list them.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "security-reviewer", name: "security-reviewer",
      run_in_background: true,
      prompt: "📋 Cast: security-reviewer
                  Role: security test coverage reviewer
                  Angle: injection / auth bypass / data leak test cases
                  Why: security paths often missed by general coverage check

               Review test plan for security-relevant test cases: <target code + test cases>.
               Follow Team Communication Protocol.
               Teammates: qa, <enabled proxies>.
               Check: injection, auth bypass, data leaks tested?
               Missing security tests → list them.
               SendMessage findings to team-lead when done.")

# For each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family test reviewer (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; independent family perspective on test design

               Review test coverage via <proxy> MCP — <assigned angle>: <target code + test cases>.
               Teammates: qa, security-reviewer.
               SendMessage findings to team-lead when done.")
```

Once TL has validated coverage, send `shutdown_request` to all teammates (cleanup is automatic at session end) before generating.

## Step 3: Generate

Write tests following project conventions:
- Match existing test file naming and structure
- Use project's test framework
- Group by: happy path → edge cases → error cases → security
- Each test: clear name describing the scenario

## Step 4: Verify

Run `test.command` from pipeline.yml. If empty → skip, show "⚠️ No test command configured, skipping test verification". All new tests must pass.

Show summary: number of tests generated, coverage areas, any skipped scenarios.

## Next Steps

Based on testgen output, suggest:
- If tests all pass → "Tests ready. Continue with `/ae:work` or `/ae:review`"
- If tests reveal gaps in implementation → "Fix implementation, then re-run tests"
- If test design reveals unclear requirements → "Consider `/ae:discuss` or `/ae:think` to clarify"
