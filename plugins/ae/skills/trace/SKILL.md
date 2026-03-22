---
name: ae:trace
description: Trace execution flow or map dependencies for a code path
argument-hint: "<function, endpoint, or module to trace>"
---

# /ae:trace — Code Tracing

Trace: **$ARGUMENTS**

## Pre-check

0. **Scratch recovery**: Scan scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`) for files with `project` matching current repo name AND `status: in_progress`. If found → list them and ask user: "上次有未完成的操作，要继续吗？"
1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "首次使用 ae 插件，正在初始化项目配置..." then auto-run `/ae:setup` flow inline. After setup completes, continue.

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

Create a Team for parallel trace validation. **Lead: architect** (validates and produces final trace).

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. If a proxy fails to connect, it should SendMessage to **architect** (the lead) that it's unavailable, then exit gracefully.

```
TeamCreate(team_name: "<target>-trace")

Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "Validate this trace for completeness and accuracy: <trace results>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, performance-reviewer, codex-proxy, gemini-proxy.
               Check: missing hops? Incorrect call order? Hidden async paths?
               Produce validated trace diagram.
               SendMessage to dependency-analyst when done.")

Agent(subagent_type: "dependency-analyst", name: "dependency-analyst",
      team_name: "<team>", run_in_background: true,
      prompt: "Analyze dependencies in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, performance-reviewer.
               Find: circular deps, tight coupling, fragile chains.
               SendMessage findings to architect when done.")

Agent(subagent_type: "performance-reviewer", name: "performance-reviewer",
      team_name: "<team>", run_in_background: true,
      prompt: "Identify performance concerns in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, dependency-analyst.
               Check: N+1 queries, unnecessary hops, blocking calls, memory issues.
               SendMessage findings to architect when done.")

Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent trace validation via Codex MCP: <target + trace results>.
               Teammates: architect, dependency-analyst, performance-reviewer.
               SendMessage findings to architect when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent trace validation via Gemini MCP: <target + trace results>.
               Teammates: architect, dependency-analyst, performance-reviewer.
               SendMessage findings to architect when done.")
```

## Step 4: Output

Architect produces:

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

1. **Auto-save to scratch**: Write results to scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`). File: `trace-YYYY-MM-DD-NNN.md` with frontmatter `type: trace`, `project: <repo-name>`, `created`, `status: done`, `target: <$ARGUMENTS>`.
2. **Ask user**: Use `AskUserQuestion` — "Trace 结果已暂存。要正式保存到 `<output.analyses>` 吗？"
   - **Yes** → copy to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-trace-slug.md`
   - **No** → keep in scratch only

Show results to user.
