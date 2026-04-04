---
id: work-drift-expected-files-match
target: ae:work
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Check B compares `git diff --name-only` against "Expected files:" from plan step
- [behavior] When all changed files are in the expected list, Check B passes with no warnings

### MUST_NOT
- [text:contains] Output contains "Drift detected" or "Unexpected" when files match exactly
- [behavior] Gate pauses or hard-stops due to drift when all files are in the expected list

### SHOULD
- [text:contains] Drift check result shown as passing (e.g. checkmark or "pass")
