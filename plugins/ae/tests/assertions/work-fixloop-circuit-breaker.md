---
id: work-fixloop-circuit-breaker
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md states: `Same test file fails N times (default: 3, configurable via pipeline.yml → work.max_fix_loops)`
- [text:contains] Circuit breaker message format: `🔴 Fix loop detected: [test file] failed [N] consecutive times.`
- [text:contains] SKILL.md defines 3 options: (1) Retry with a different approach, (2) Skip this subtask and defer, (3) Pause for human help
- [text:contains] Default threshold is 3, configurable via `pipeline.yml → work.max_fix_loops`

### MUST_NOT
- [behavior] MUST NOT continue retrying the same approach indefinitely without triggering the circuit breaker
- [behavior] MUST NOT trigger on failures across different test files — counter is per test file, not global
- [behavior] MUST NOT hard-code threshold to 3 — must respect `pipeline.yml → work.max_fix_loops` when set
