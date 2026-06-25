---
name: ae:trace
description: Trace execution flow or map dependencies for a code path
argument-hint: "<function, endpoint, or module to trace>"
user-invocable: true
---

# /ae:trace — Code Tracing

Trace: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:trace creates exactly **3 tasks** per invocation (1 Pre-check + Analysis + Synthesis). Mode determination (Step 1), Initial trace (Step 2), and Persist (Step 5) are sub-actions — no separate tasks.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:trace: Pre-check` | At skill start | Immediately before pre-check 1 | After pre-checks pass (control reaches Step 1 Determine Mode) |
| `ae:trace: Analysis (architect + dependency-analyst + performance-reviewer + proxy)` | At skill start (batch) | When the first analysis agent is spawned in Step 3 | When all spawned analysis agents have returned findings at TL |
| `ae:trace: Synthesis` | At skill start (batch) | When TL begins merging analysis findings into the final trace output | When trace output is persisted to `output.analyses` |

At skill start, batch-create:

```
TaskCreate(subject: "ae:trace: Pre-check")
TaskCreate(subject: "ae:trace: Analysis (architect + dependency-analyst + performance-reviewer + proxy)")
TaskCreate(subject: "ae:trace: Synthesis")
```

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:trace: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After pre-checks pass, call `TaskUpdate(taskId, status: "completed")`.
Same lifecycle applies to Analysis and Synthesis phase tasks — `TaskUpdate(taskId, status: "in_progress")` when the phase begins, `TaskUpdate(taskId, status: "completed")` when the phase's completion criterion is met.

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.

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

Spawn teammates for parallel trace validation (Investigation Mode). **TL synthesizes**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback.

```
Agent(subagent_type: "architect", name: "architect",
      run_in_background: true,
      prompt: "📋 Cast: architect
                  Role: trace validator (structural)
                  Angle: trace completeness + accuracy + missing hops
                  Why: primary structural validator for execution flow

               Validate this trace for completeness and accuracy: <trace results>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, performance-reviewer, <enabled proxies>.
               Check: missing hops? Incorrect call order? Hidden async paths?
               Produce validated trace diagram.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "dependency-analyst", name: "dependency-analyst",
      run_in_background: true,
      prompt: "📋 Cast: dependency-analyst
                  Role: trace dependency analyzer
                  Angle: circular deps + tight coupling + fragile chains
                  Why: complements architect by surfacing dep-graph weaknesses

               Analyze dependencies in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, performance-reviewer.
               Find: circular deps, tight coupling, fragile chains.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "performance-reviewer", name: "performance-reviewer",
      run_in_background: true,
      prompt: "📋 Cast: performance-reviewer
                  Role: trace performance reviewer
                  Angle: N+1 queries + blocking calls + memory hotspots in execution path
                  Why: hot-path identification per trace target

               Identify performance concerns in this trace: <trace results>.
               Follow Team Communication Protocol.
               Teammates: architect, dependency-analyst.
               Check: N+1 queries, unnecessary hops, blocking calls, memory issues.
               SendMessage findings to team-lead when done.")

# For each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family trace validator (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; independent family perspective

               Independent trace validation via <proxy> MCP — <assigned angle>: <target + trace results>.
               Teammates: architect, dependency-analyst, performance-reviewer.
               SendMessage findings to team-lead when done.")
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
│ └── imports D (transitive)
└── implements Interface E
```

Include:
- Validated trace with file:line references
- Issues found (coupling, performance, missing error handling)
- Recommendations

Shut down teammates (shutdown_request → shutdown_response); the implicit team is cleaned up automatically at session end.

## Step 5: Persist

Write results directly to `pipeline.yml` → `output.analyses` (default: `.ae/analyses/`) as `NNN-trace-slug.md`.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show results to user.

## Next Steps

Based on trace output, suggest:
- If trace reveals architectural issues → "Consider `/ae:discuss` to decide on refactoring approach"
- If trace reveals performance concerns → "Run `/ae:think` for performance analysis, or `/ae:plan` for optimization"
- If trace is informational → "Use findings to inform current `/ae:work` or `/ae:plan`"
