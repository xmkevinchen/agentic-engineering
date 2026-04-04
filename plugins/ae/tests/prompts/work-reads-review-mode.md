---
id: work-reads-review-mode
target: ae:work
layer: 2
source: manual
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with `work.review_mode: light`
- A plan file exists with at least one pending step (`- [ ]`)
- `test.command` is empty

## Prompt
/ae:work --light docs/plans/test-plan.md

## Prompt Variants
- /ae:work docs/plans/test-plan.md (with pipeline.yml review_mode: light)
- /ae:work --full docs/plans/test-plan.md (should override to full)
