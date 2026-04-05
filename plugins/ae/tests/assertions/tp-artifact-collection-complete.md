---
id: tp-artifact-collection-complete
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] After execution, Session TL runs `git diff --name-only` in worktree to collect file changes
- [behavior] For changed files, Session TL captures file content snapshots (not just filenames) before worktree cleanup
- [behavior] Session TL checks `~/.claude/teams/` for new inboxes/ directories (team creation evidence)
- [behavior] Session TL captures execution output text and includes it in artifacts sent to test-lead

### MUST_NOT
- [behavior] Artifacts sent to test-lead contain only filenames without content when [file:contains] assertions exist
- [behavior] Worktree is removed before file content snapshots are collected

### SHOULD
- [behavior] Artifacts include state change evidence (plan/task frontmatter status transitions if applicable)
