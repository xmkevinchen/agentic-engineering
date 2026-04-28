---
id: work-argument-inference-reviewed-only
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Argument Inference section defines auto-detection logic when `$ARGUMENTS` is empty
- Inference unions BOTH `.ae/features/active/F-*/plan.md` (primary, Plan 051+) AND `output.plans/*.md` (legacy fallback) for the most recent plan matching specific status criteria. Tiebreaker applies across the union of both locations.

## Prompt
(static analysis — no execution required)
