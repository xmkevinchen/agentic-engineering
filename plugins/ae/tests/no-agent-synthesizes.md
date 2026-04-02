---
id: no-agent-synthesizes
target: ae:consensus, ae:review, ae:analyze, ae:plan, ae:plan-review, ae:think, ae:trace, ae:testgen, ae:team
layer: 1
source: generated
---

## Context
- SKILL.md files for all 9 agent-teams skills are readable
- This is a protocol invariant check across all skills

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- Every skill has an explicit TL synthesis step (TL collects and synthesizes, not an agent)
- Challenger prompt in ae:review and ae:analyze contains "Do NOT synthesize" or equivalent

### MUST_NOT
- No Agent() prompt contains "synthesize" as an agent action verb
- No Agent() prompt contains "integrate feedback" as an agent action
- No Agent() prompt contains "merge results" as an agent action
