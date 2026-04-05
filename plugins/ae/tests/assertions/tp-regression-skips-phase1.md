---
id: tp-regression-skips-phase1
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] No TeamCreate call issued for test generation team
- [behavior] No prompts-writer or answer-writer agents spawned
- [behavior] Skill proceeds directly to Phase 2 execution using existing test files

### MUST_NOT
- [behavior] No new test files written to plugins/ae/tests/ directory
- [behavior] No existing test files deleted or overwritten

### SHOULD
- [text:contains] Output explicitly states regression mode active or that generation is skipped
