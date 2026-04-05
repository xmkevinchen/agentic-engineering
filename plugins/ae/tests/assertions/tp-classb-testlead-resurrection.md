---
id: tp-classb-testlead-resurrection
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Resurrected test-lead reads assertion files from main repo path (`plugins/ae/tests/assertions/`), NOT from worktree path
- [behavior] Resurrected test-lead does NOT regenerate test cases — enters Judge mode directly
- [behavior] Resurrected test-lead judges by assertion text only, not inferred design intent

### MUST_NOT
- [behavior] Resurrected test-lead reads assertion files from worktree (Phase 1 files are uncommitted and invisible in worktree)
- [behavior] Resurrected test-lead produces new test case outlines or delegates to writers

### SHOULD
- [behavior] Resurrected test-lead waits for artifacts from Session TL before issuing verdicts
