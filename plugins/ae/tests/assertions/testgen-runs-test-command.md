---
id: testgen-runs-test-command
target: ae:testgen
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Step 4 runs `test.command` from pipeline.yml to verify generated tests
- [behavior] SKILL.md requires all new tests to pass after generation
- [text:contains] SKILL.md shows summary of tests generated, coverage areas, and any skipped scenarios

### MUST_NOT
- [behavior] MUST NOT skip test verification when test.command is configured
- [behavior] MUST NOT consider generation complete if generated tests fail

### SHOULD
- [text:contains] When test.command is empty, SKILL.md shows "⚠️ No test command configured, skipping test verification"
- [behavior] Empty test.command does not block generation — shows warning and continues
