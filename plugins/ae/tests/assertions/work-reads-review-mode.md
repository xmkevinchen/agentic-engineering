---
id: work-reads-review-mode
target: ae:work
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [text:contains] Pre-commit code review step mentions "light" mode or "Claude-only" or "Track 1 only"
- [behavior] Does NOT spawn codex-proxy or gemini-proxy agents for code review when in light mode

### MUST_NOT
- [behavior] When --light or review_mode: light: no cross-family proxy tool calls in code review phase
- [behavior] When --full override: must NOT skip cross-family (full 3-track)

### SHOULD
- [text:contains] Output explicitly states which review mode is active
