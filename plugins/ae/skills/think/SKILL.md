---
name: ae:think
description: Deep multi-step reasoning for complex architecture decisions, hard bugs, or performance analysis. Recommended: Sonnet or above
argument-hint: "<problem or question>"
user-invocable: true
effort: high
---

# /ae:think — Deep Analysis

Perform systematic deep analysis on: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:think creates exactly **3 tasks** per invocation (1 Pre-check + Investigation + Synthesis). Frame (Step 1) and Persist (Step 4) are sub-actions — no separate tasks.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:think: Pre-check` | At skill start | Immediately before pre-check 1 | After pre-checks pass (control reaches Step 1 Frame) |
| `ae:think: Investigation (architect + standards-expert + challenger + proxy)` | At skill start (batch) | When the first investigation agent is spawned in Step 2 | When all spawned investigation agents have returned findings at TL |
| `ae:think: Synthesis` | At skill start (batch) | When TL begins merging investigation findings into the final analysis | When analysis output is persisted to `output.analyses` |

At skill start, batch-create:

```
TaskCreate(subject: "ae:think: Pre-check")
TaskCreate(subject: "ae:think: Investigation (architect + standards-expert + challenger + proxy)")
TaskCreate(subject: "ae:think: Synthesis")
```

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:think: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After pre-checks pass, call `TaskUpdate(taskId, status: "completed")`.
Same lifecycle applies to Investigation and Synthesis phase tasks — `TaskUpdate(taskId, status: "in_progress")` when the phase begins, `TaskUpdate(taskId, status: "completed")` when the phase's completion criterion is met.

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue.
2. **Agent Teams**: Run `check-agent-teams.sh` (exit 0 = available; exit 1 = unavailable, prints the reason). If exit 1 → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL executing directly (no team spawn).

## Step 1: Frame

1. Read project CLAUDE.md, relevant code, and docs
2. Identify the core question and constraints
3. Form initial hypothesis
4. List relevant files and modules

### 1.5. Prior Context (from Mengdie)

Run this step after Frame (Step 1) and before spawning the team (Step 2).

1. Call `memory_search` MCP tool with the $ARGUMENTS problem statement as query
2. If `memory_search` is not available, fails, or returns no results — emit `Prior context: unavailable (tool not registered / no relevant results)` and continue to Step 2
3. If results returned with `degraded` field non-null — annotate results as "(partial — [degraded reason])"
4. Present results under `## Prior Art from Project Knowledge Base` with provenance for each item: `title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`
5. Include prior art in the topic brief for agents in Step 2 — treat as background context, does not constrain analysis

## Step 2: Agent Teams Investigation

Spawn teammates for parallel deep investigation (Investigation Mode). **TL synthesizes**.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. Include enabled proxy agents. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback.

```
Agent(subagent_type: "architect", name: "architect",
      run_in_background: true,
      prompt: "📋 Cast: architect
                  Role: deep-think lead (structural/design)
                  Angle: problem decomposition + design trade-offs
                  Why: primary structural perspective for deep investigation

               Analyze this problem from a structural/design perspective: <problem + hypothesis + relevant files>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger, <enabled proxies>.
               Produce analysis with evidence from code.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      run_in_background: true,
      prompt: "📋 Cast: standards-expert
                  Role: deep-think support (industry comparison)
                  Angle: framework + version specific best practices for this problem
                  Why: ground architect's analysis in mainstream patterns

               Evaluate against industry best practices and known patterns: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, challenger.
               Wait for architect's analysis before evaluating.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "challenger", name: "challenger",
      run_in_background: true,
      prompt: "📋 Cast: challenger
                  Role: opposition (think mode)
                  Angle: blind spots in architect's analysis + alternative explanations
                  Why: deep-investigation needs adversarial check before TL synthesizes (F-019 challenger.md migration: mode behavior embedded here)

               Think mode protocol steps (embedded per F-019 mode migration):
               1. Wait for architect's analysis (TL forwards).
               2. Independent challenge: find blind spots, untested assumptions, alternative explanations specific to this single deep-investigation question.
               3. Cross-family check: call Codex/Gemini if needed for independent perspective on the question.
               4. Aggregate: SendMessage challenges to team-lead with structured format (Claim/Evidence/Objection/Confidence).

               Challenge the architect's analysis. Find blind spots, untested assumptions, alternative explanations: <problem>.
               Follow Team Communication Protocol.
               Teammates: architect, standards-expert.
               Wait for architect's analysis before challenging.
               SendMessage challenges to team-lead when done.")

# For each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family deep-think (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; independent family perspective on deep question

               Independent analysis of this problem via <proxy> MCP — <assigned angle>: <problem + relevant files>.
               Teammates: architect, standards-expert, challenger.
               SendMessage findings to team-lead when done.")
```

**TL Orchestration — dependency graph**:
- architect → standards-expert: When architect reports findings, TL forwards to standards-expert (who waits for architect's analysis before evaluating)
- architect → challenger: When architect reports findings, TL forwards to challenger (who waits for architect's analysis before challenging)

## Step 3: TL Synthesizes

TL collects all findings and integrates perspectives:

- **Confirmed** — points all agents agree on
- **Contested** — disagreements with arguments from each side
- **Blind spots** — issues only raised by challenger or cross-family
- **Recommendation** — actionable conclusion with confidence level (low/medium/high)

Shut down teammates via the shutdown_request → shutdown_response handshake; cleanup is automatic at session end.

## Step 4: Persist

Write analysis directly to `pipeline.yml` → `output.analyses` (default: `.ae/analyses/`).

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

File naming: `NNN-slug.md` — three-digit sequential number + slug derived from topic.

```markdown
---
id: "NNN"
title: "Analysis: [topic]"
type: analysis
created: YYYY-MM-DD
status: done
---
```

Content sections:
- Problem statement
- Key findings
- Recommendation
- Dissenting views

Show summary to user.

## Next Steps

Based on thinking output, suggest:
- If recommendation is actionable → "Ready for `/ae:plan` to define implementation, or `/ae:discuss` if design decisions remain"
- If confidence is low → "Consider `/ae:analyze` for broader research, or `/ae:consensus` for structured debate"
- If problem is execution-level → "Ready for `/ae:work` or `/ae:testgen`"
