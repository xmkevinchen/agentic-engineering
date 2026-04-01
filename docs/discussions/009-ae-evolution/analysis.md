---
id: "009"
title: "Analysis: AE Evolution to Autonomous Problem-Solving"
type: analysis
created: 2026-04-01
tags: [evolution, autonomy, web-research, self-improvement]
---

# Analysis: AE Evolution to Autonomous Problem-Solving

## Question
How should AE evolve from a scripted orchestration framework to a genuinely autonomous problem-solving system with web research, self-improvement, and TL accountability?

## Findings

### Relevant Code (Archaeologist)
- 13 agents: 12/13 classified as "fully autonomous" but this is misleading — autonomy is within TL-constructed context, not independent
- 14 skills: 5 fully automated (think, trace, analyze, testgen, code-review), 9 require human gates
- Web research: only `standards-expert` has WebSearch/WebFetch tools
- context7 MCP available but unused by any agent
- Outcome Statistics in review/SKILL.md:148-159 — generated but never consumed
- Memory system (MEMORY.md) is manually maintained

### Architecture & Patterns
- **TL is single point of failure**: all context construction, agent selection, and convergence decisions flow through TL
- **Cross-family is opinion layer**: proxies receive only what TL sends them (gemini-proxy.md:102 "no repo access")
- **Feedback loop is broken**: statistics generated → file written → no reader → no behavior change
- **Pipeline never completed end-to-end**: discuss→plan→work→review has never been fully executed (Discussion 008 evidence)

### Industry Practice Comparison (Standards Expert)
- Leading frameworks (LangGraph, CrewAI, AutoGen) use goal-oriented agents with tool selection autonomy
- Autonomous coding agents (Devin, Codex) achieve 80%+ on SWE-bench but 40-62% of generated code has security vulnerabilities
- Industry consensus: escalation should be explicit nodes, not implicit auto-triggers
- Self-improvement patterns: reflection loops, MAR (multi-agent reflection) — 2-3 iterations before diminishing returns
- AE's supervised autonomy (gates, drift checks, P1/P2 disposition) is actually aligned with industry safety practices

### Challenges & Disagreements (Challenger)

**Challenge 1**: "Fully autonomous" agent classification is misleading — real autonomy bottleneck is TL's context quality, not agent internal logic.

**Challenge 2**: Industry benchmarks (SWE-bench 80%) don't apply — AE's supervised approach is a feature against the 40-62% vulnerability rate.

**Challenge 3**: Gemini's AE_Orchestrator proposal skips the hardest step — persistent state infrastructure doesn't exist.

**Challenge 4 (most critical)**: Everyone answered "what features to add" but the right question is "what existing features have never been executed." All 5 original Discussion 008 topics shared the same root cause: no execution data.

### Cross-family Perspectives
- **Codex**: Goal-oriented design > task-oriented. Agents should have goals and tool selection freedom, not step-by-step scripts. Reflection after action is key.
- **Gemini**: AE_Orchestrator pattern (Observe→Evaluate→Propose→Execute) is the right direction, but needs persistent state. Web research should be a first-class skill.

## Summary

AE's evolution path is **not about adding features** — it's about establishing a running baseline first, then using data to drive improvements.

The 5-phase roadmap (evidence-backed):

1. **Complete the pipeline** — run discuss→plan→work→review end-to-end once, producing Outcome Statistics
2. **Execution observability** — ae:retrospect skill that reads historical statistics and generates actionable reports
3. **Web research integration** — activate standards-expert in discuss phase + context7 for library docs
4. **Lightweight orchestration** — cross-skill state awareness with "next step" suggestions (not full Orchestrator)
5. **Self-improvement loop** — pattern-based context hints from historical data (with human approval gate)

Key constraint: each phase must produce execution data before the next phase is designed (先运行后决策 principle).

## Late Additions (Codex + Archaeologist second pass)

### Codex Challenge — Doodlestein 时机 (accepted)
Current Doodlestein only fires after all topics converge (Step 8). High-risk topics (reversibility: low) should trigger real-time challenge at Score time (Step 3), not just post-hoc review. Minimal change: add cross-family challenge step for low-reversibility topics before they "lock in."

### Codex Challenge — Web research trigger precision (accepted)
Standards-expert activation in discuss should trigger on: (1) topic's key data is external/time-sensitive, (2) codebase search done but confidence low. Not on vague "involves tech choice."

### Codex Challenge — "over-scripted" diagnosis (rejected)
Codex framed ae:discuss's Research→Score→Sweep→Doodlestein as "stage lock-in." Challenger rebutted: Sweep's rigidity is anti-avoidance design (validated across v0.0.9-v0.2.0), not control flow overhead. Decision process scripts serve different purpose than coding task scripts.

## Possible Next Steps
→ `/ae:discuss` on the 5-phase roadmap — decide priorities, identify dependencies, resolve design questions
→ Or: directly `/ae:plan` Phase 1 (complete the pipeline) since it's the uncontested first step

