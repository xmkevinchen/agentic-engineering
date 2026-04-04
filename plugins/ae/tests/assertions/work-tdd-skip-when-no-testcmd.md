---
id: work-tdd-skip-when-no-testcmd
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md TDD Cycle section states: `If test.command is empty → skip TDD, implement directly.`
- [text:contains] SKILL.md Check C states: `Empty → skip with "⚠️ No test command configured"`
- [behavior] When `test.command` is empty, TDD cycle (write test → red → implement → green) is skipped entirely

### MUST_NOT
- [behavior] MUST NOT attempt to write tests when `test.command` is empty
- [behavior] MUST NOT attempt to run tests when `test.command` is empty
- [behavior] MUST NOT block or refuse execution when test command is absent — implementation proceeds directly
