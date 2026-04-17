---
id: next-sprint-aware
target: ae:next
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md includes a step (Step 10) titled "Committed sprint items without discussion/plan" or similar sprint-awareness language
- [text:contains] SKILL.md describes checking `.ae/backlog/<current-version>/` for BL items with no matching discussion or plan
- [text:contains] SKILL.md references the current-version determination rule from ae:roadmap (does NOT duplicate it)
- [text:contains] SKILL.md renumbers the old "All work complete" step to Step 11 (so the sprint-awareness check runs before the terminal check)

### MUST_NOT
- [text:contains] No duplicated current-version rule inline (must reference ae:roadmap's spec to avoid drift)
- [text:contains] No suggestion to skip sprint awareness when sprint structure IS present (sprint-awareness must trigger whenever a current version exists)

### SHOULD
- [text:contains] SKILL.md includes a skip condition for legacy flat backlog (when no `v*/` subdirs exist in `output.backlog`)
- [text:contains] SKILL.md suggests `/ae:discuss <BL-ID>` or `/ae:plan <BL-ID>` as the next action
- [text:contains] SKILL.md applies a tiebreaker (e.g., highest priority, lowest BL ID) when multiple items match
