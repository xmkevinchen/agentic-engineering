---
name: ae:testgen
description: Generate comprehensive test suites with edge case coverage for specific code
argument-hint: "<file, function, or module to test>"
---

# /ae:testgen — Test Generation

Generate tests for: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."
3. Read `test.command` and `test.framework` from pipeline.yml

## Step 1: Analyze

1. Read the target code thoroughly
2. Map code paths: happy path, error paths, edge cases
3. Identify boundary conditions, null/empty inputs, type coercions
4. Check existing tests for patterns and conventions
5. Note dependencies that need mocking

## Step 2: Agent Teams Review

Create a Team for parallel test planning review (Investigation Mode). **TL validates coverage**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents.

```
TeamCreate(team_name: "<target>-testgen")

Agent(subagent_type: "qa", name: "qa",
      team_name: "<team>", run_in_background: true,
      prompt: "Review this test plan for completeness: <target code summary + proposed test cases>.
               Follow Team Communication Protocol.
               Teammates: security-reviewer, codex-proxy, gemini-proxy.
               Check: all code paths covered? Edge cases? Error handling?
               Missing scenarios → list them.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "security-reviewer", name: "security-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Review test plan for security-relevant test cases: <target code + test cases>.
               Follow Team Communication Protocol.
               Teammates: qa, codex-proxy, gemini-proxy.
               Check: injection, auth bypass, data leaks tested?
               Missing security tests → list them.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review test coverage via Codex MCP — <specialized focus based on context>: <target code + test cases>.
               Teammates: qa, security-reviewer.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Review test coverage via Gemini MCP — <specialized focus based on context>: <target code + test cases>.
               Teammates: qa, security-reviewer.
               SendMessage findings to Lead (TL) when done.")
```

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
