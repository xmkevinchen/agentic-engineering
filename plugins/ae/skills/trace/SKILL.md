---
name: ae:trace
description: Trace execution flow or map dependencies for a code path
argument-hint: "<function, endpoint, or module to trace>"
---

# /ae:trace — Code Tracing

Trace: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1: Determine Mode

Ask user if not obvious:
- **flow** — trace execution path (request → response, function call chain)
- **deps** — map structural dependencies (imports, inheritance, data flow)

## Step 2: Initial Trace

1. Find the entry point
2. Follow the call chain / dependency graph step by step
3. Record each hop: file, function, line number
4. Note: side effects, async boundaries, external calls, error handlers

## Step 3: Agent Teams Analysis

Create a Team for parallel trace validation (Investigation Mode). **TL synthesizes**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family).

```
TeamCreate(team_name: "<target>-trace")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Validate this trace for completeness and accuracy: <trace results>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, performance-reviewer, codex-proxy, gemini-proxy.
               Check: missing hops? Incorrect call order? Hidden async paths?
               Produce validated trace diagram.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "dependency-analyst", name: "dependency-analyst",
      team_name: "<team>", run_in_background: true,
      prompt: "Analyze dependencies in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, performance-reviewer.
               Find: circular deps, tight coupling, fragile chains.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "performance-reviewer", name: "performance-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Identify performance concerns in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, dependency-analyst.
               Check: N+1 queries, unnecessary hops, blocking calls, memory issues.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent trace validation via Codex MCP — <specialized focus based on context>: <target + trace results>.
               Teammates: architect, dependency-analyst, performance-reviewer.
               SendMessage findings to Lead (TL) when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent trace validation via Gemini MCP — <specialized focus based on context>: <target + trace results>.
               Teammates: architect, dependency-analyst, performance-reviewer.
               SendMessage findings to Lead (TL) when done.")
```

## Step 4: TL Synthesizes Output

TL collects all findings and produces:

### Flow mode
```
Entry → A.method() → B.service() → C.query() → Response
         ↳ side effect: cache write
                        ↳ async: event emitted
```

### Deps mode
```
Module A
├── imports B (direct)
├── imports C (direct)
│   └── imports D (transitive)
└── implements Interface E
```

Include:
- Validated trace with file:line references
- Issues found (coupling, performance, missing error handling)
- Recommendations

Close the Team.

## Step 5: Persist

Write results directly to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-trace-slug.md`.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show results to user.

## Next Steps

Based on trace output, suggest:
- If trace reveals architectural issues → "Consider `/ae:discuss` to decide on refactoring approach"
- If trace reveals performance concerns → "Run `/ae:think` for performance analysis, or `/ae:plan` for optimization"
- If trace is informational → "Use findings to inform current `/ae:work` or `/ae:plan`"
