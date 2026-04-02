---
id: work-reads-review-mode
target: ae:work
layer: 2
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

## Expected Behavior

### MUST
- Pre-commit code review step mentions "light" mode or "Claude-only" or "Track 1 only"
- Does NOT spawn codex-proxy or gemini-proxy agents for code review when in light mode

### MUST_NOT
- When --light or review_mode: light: no cross-family proxy tool calls in code review phase
- When --full override: must NOT skip cross-family (full 3-track)

### SHOULD
- Output explicitly states which review mode is active
