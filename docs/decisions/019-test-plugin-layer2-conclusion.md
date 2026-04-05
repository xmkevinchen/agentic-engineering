---
id: "019"
title: "test-plugin Layer 2 Architecture Redesign — Conclusion"
concluded: 2026-04-03
plan: ""
---

# test-plugin Layer 2 Architecture Redesign — Conclusion

## Decision Summary (Converged)

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | Layer 2 execution model | Hybrid: Class A (no Agent Teams) subagent executes, Class B (Agent Teams) Session TL executes | subagent cannot TeamCreate (hard constraint). Hybrid preserves real execution for both skill classes. Unanimous. | high |
| 2 | Artifact-based verification | Typed assertions: `[file]` git diff, `[team]` inboxes/ dir, `[text]` output keywords, `[behavior]` LLM judge. Outcome + Process dual verification. | git diff most reliable (all agents). Team detection via inboxes/ not config.json (archaeologist verified). Codex: Outcome + Process prevents false positives from correct artifacts + wrong reasoning. | high |
| 3 | Multi-run strategy | **Deferred** — defer to after first real Layer 2 execution provides data | Doodlestein Strategic challenge: premature optimization of a system that has never executed. Doodlestein Regret: run counts will face cost pressure and be reworked. If implemented later, design as pipeline.yml configurable defaults. | — |
| 4 | Judge design | **Deferred** — defer to after real execution data | Current SKILL.md already has codex/gemini/claude judge config. Mechanical assertions can bypass LLM judge without formal redesign. Cross-family judge preference is established but not urgent. | — |

## Additional Decisions

| Decision | Rationale |
|----------|-----------|
| No Layer 1.5 | SKILL.md is natural language, not machine-parseable schema. Extracting tool call plans requires LLM reasoning = same as Layer 2 without real execution. Architect + Archaeologist + Gemini all reject. |
| blind-protocol-layer2.md: split and reclassify | Testable assertions (protocol defined in SKILL.md) → Layer 1. Untestable assertions (absence of evidence: "TL didn't read Expected Behavior") → delete. Archaeologist: "盲协议执行合规无法外部验证" |
| Golden test set: existing mechanism sufficient | `source: manual` + `source: regression` in test-plugin SKILL.md already cover this. Judge calibration is long-term maintenance, not urgent design gap. |

## Doodlestein Review

| Challenge | Resolution |
|-----------|------------|
| Q1 Strategic: "Ship only T01, defer T02-T04" | Partially accepted. T01 alone insufficient — without T02 artifact collection, execution degrades to walkthrough. Ship T01+T02, defer T03+T04. |
| Q2 Adversarial: "Layer 2 solves a non-existent problem" | Refuted. Archaeologist provided 3 concrete bug cases caught by /ae:review that Layer 2 runtime artifacts would detect systematically (test-lead premature shutdown, MCP tool routing, peer routing violation). Real usage tests happy path only, not edge paths. |
| Q3 Regret: "T03 run counts will be reversed" | Accepted. T03 deferred. When implemented, must be configurable defaults in pipeline.yml, not hardcoded. |

## Team Composition

| Agent | Role | Backend | Joined |
|-------|------|---------|--------|
| TL | Moderator | Claude | Start |
| architect | System architecture | Claude | Start |
| archaeologist | Capability boundary analysis | Claude | Start |
| codex-proxy | Cross-family design perspective | Codex (OpenAI) | Start |
| gemini-proxy | Cross-family design perspective | Gemini (Google) | Start |
| doodlestein-strategic | Q1 Smartest Alternative | Claude | Doodlestein |
| doodlestein-adversarial | Q2 Problem Validity | Claude | Doodlestein |
| doodlestein-regret | Q3 Regret Prediction | Claude | Doodlestein |

## Process Metadata
- Discussion rounds: 2
- Topics: 4 total (2 converged, 2 deferred)
- Autonomous decisions: 7 (4 topics + 3 additional)
- User escalations: 0
- Doodlestein challenges: 3 raised, 3 resolved (1 partially accepted, 1 refuted, 1 accepted → T03 deferred)
- Deferred resolved in Sweep: T03/T04 deferred by design (Doodlestein-driven scope reduction)

## Next Steps
→ `/ae:plan` for T01 (hybrid execution) + T02 (artifact collection) + blind-protocol reclassification
→ After first real Layer 2 execution: revisit T03 (run counts) + T04 (judge design) with data
