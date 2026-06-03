---
id: consensus-verdict-dejargon
target: ae:consensus
layer: 1
source: regression
---

## Context

F-037 rewrote the user-facing verdict template in `plugins/ae/skills/consensus/SKILL.md` to a judgment-first shape (`## Recommendation`) and removed process-machine fields from it. The internal Phase 1 routing (ROUND_DECISION) is intentionally untouched.

## Prompt

Static analysis of `plugins/ae/skills/consensus/SKILL.md`: verify the verdict template region (from the Phase 2 template heading to the next `## ` heading) carries the decision-first shape and no process-record fields, while the Phase 1 internal flow keeps its routing instructions.
