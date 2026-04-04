---
id: work-fixloop-circuit-breaker
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- TDD Cycle section defines a Fix Loop Circuit Breaker mechanism
- Default threshold: 3 consecutive failures per test file
- Configurable via `pipeline.yml → work.max_fix_loops`

## Prompt
(static analysis — no execution required)
