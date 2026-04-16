---
id: review-verdict-field-required
target: ae:review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md output frontmatter requires a `verdict` field (pass or fail)
- [text:contains] SKILL.md states that `verdict` enables /ae:dashboard and /ae:next to determine review completion
- [text:contains] SKILL.md output frontmatter includes: id, title, type: review, created, target, verdict

### MUST_NOT
- [behavior] MUST NOT write a review file without the `verdict:` field in frontmatter
- [behavior] MUST NOT omit the verdict even when all findings are P3 (minor)

### SHOULD
- [text:contains] The verdict field accepts values "pass" or "fail"
