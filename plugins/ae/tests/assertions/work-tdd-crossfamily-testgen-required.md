---
id: work-tdd-crossfamily-testgen-required
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md TDD Cycle step 3 states: `Cross-family testgen — Codex suggests edge cases`
- [text:contains] SKILL.md TDD Cycle step 4 states: `Synthesize — merge Claude + cross-family test ideas`
- [text:contains] TDD cycle defines exactly 7 steps: write test → confirm red → cross-family testgen → synthesize → implement → confirm green → refactor

### MUST_NOT
- [behavior] MUST NOT omit cross-family testgen step when `test.command` is present
- [behavior] MUST NOT proceed from "confirm red" directly to "implement" — cross-family testgen and synthesize steps are required between them
