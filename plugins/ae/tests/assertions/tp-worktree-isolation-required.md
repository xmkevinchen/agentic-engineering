---
id: tp-worktree-isolation-required
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md requires git worktree creation before Layer 2 execution (both Class A and B)
- [file:contains] SKILL.md specifies worktree creation failure → FAIL_CLOSED with `isolation_error`
- [file:contains] SKILL.md specifies worktree cleanup: `git worktree remove` + `git branch -D` after execution
- [file:contains] SKILL.md specifies do NOT execute without isolation if worktree creation fails

### MUST_NOT
- [file:contains] SKILL.md allows Layer 2 execution directly in the main working directory
