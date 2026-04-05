---
id: work-no-git-push-hook-in-frontmatter
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- The git push hook was removed from ae:work
- The SKILL.md frontmatter should have no hook entries (or specifically no git push hook)

## Prompt
(static analysis — no execution required)

## Prompt Variants
- Variant: verify no `hooks` field exists in SKILL.md frontmatter
- Variant: if `hooks` field exists, verify it contains no git push entry
