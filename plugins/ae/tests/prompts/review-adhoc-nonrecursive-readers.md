---
id: review-adhoc-nonrecursive-readers
target: ae:review
layer: 1
source: regression
---

## Context

F-012 introduces a cross-skill contract: the 4 review-reading skills (ae:dashboard / ae:next / ae:plugin-stats / ae:retrospect) MUST scan with a non-recursive glob `output.reviews/*.md`, which naturally excludes ad-hoc reviews under the `output.reviews/adhoc/` subdirectory. This test is the enforced cross-skill contract guard — if any future change switches a reader skill to a recursive glob (`**/*.md`), this test fails, forcing the reviewer to acknowledge the contract impact.

## Prompt

For each of the four review-reading skill files, answer:

1. `plugins/ae/skills/dashboard/SKILL.md` — what glob pattern does it use to scan reviews? Is it recursive (`**`) or non-recursive (`*.md`)?
2. `plugins/ae/skills/next/SKILL.md` — same question.
3. `plugins/ae/skills/plugin-stats/SKILL.md` — same question.
4. `plugins/ae/skills/retrospect/SKILL.md` — same question.

Quote the exact glob pattern from each file. State PASS/FAIL per skill: PASS if pattern is `output.reviews/*.md` (or equivalent non-recursive form); FAIL if pattern is `output.reviews/**/*.md` or any recursive descent that would surface `output.reviews/adhoc/*.md` files.
