---
id: setup-defaults-canonical
target: ae:setup
layer: 1
source: generated
---

## Context
- F-006 Step 1 normalized all reader skills' default fallbacks to `.ae/<slot>/` (GTD-first canonical per Plan 050+)
- 12 skill files + setup Output Defaults table affected

## Prompt
Read the ae:setup SKILL.md Output Defaults table and any `(default: ...)` parentheticals across reader skill SKILL.md files. Verify all defaults for `output.discussions`, `output.plans`, `output.milestones`, `output.backlog`, `output.reviews`, `output.analyses` are stated as `.ae/<slot>/` and NOT `docs/<slot>/`.

## Prompt Variants
- What is the canonical default for `output.discussions`?
- Do reader skills agree on the default fallback for `output.reviews`?
