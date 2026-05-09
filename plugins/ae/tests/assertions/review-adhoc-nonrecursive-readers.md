---
id: review-adhoc-nonrecursive-readers
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### All 4 reader skills use non-recursive glob (cross-skill contract)

- [text:contains_in_file path=plugins/ae/skills/dashboard/SKILL.md] `output.reviews/*.md` (non-recursive single-asterisk form)
- [text:contains_in_file path=plugins/ae/skills/next/SKILL.md] `output.reviews/*.md`
- [text:contains_in_file path=plugins/ae/skills/plugin-stats/SKILL.md] `output.reviews/*.md`
- [text:contains_in_file path=plugins/ae/skills/retrospect/SKILL.md] `output.reviews/*.md`

### MUST_NOT

- [text:not_contains_in_file path=plugins/ae/skills/dashboard/SKILL.md] `output.reviews/**/*.md` (recursive form would surface adhoc)
- [text:not_contains_in_file path=plugins/ae/skills/next/SKILL.md] `output.reviews/**/*.md`
- [text:not_contains_in_file path=plugins/ae/skills/plugin-stats/SKILL.md] `output.reviews/**/*.md`
- [text:not_contains_in_file path=plugins/ae/skills/retrospect/SKILL.md] `output.reviews/**/*.md`

### SHOULD

- [text:contains_in_file path=plugins/ae/skills/review/SKILL.md] cross-skill contract claim references "non-recursive" OR `*.md` glob explicitly (anchors the contract in the writer's spec)
