---
id: work-no-git-push-hook-in-frontmatter
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] ae:work SKILL.md frontmatter contains no `hooks` key
- [text:contains] ae:work SKILL.md frontmatter contains no git push hook entry

### MUST_NOT
- [behavior] MUST NOT have any hook referencing `git push` or `PostGitPush` in SKILL.md frontmatter
- [behavior] MUST NOT define any hook-based behavior in the skill's YAML frontmatter
