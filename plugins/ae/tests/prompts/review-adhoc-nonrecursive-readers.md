---
id: review-adhoc-nonrecursive-readers
target: ae:review
layer: 1
source: regression
---

## Context

F-012 引入跨技能 contract：4 个 review-reading skill (ae:dashboard / ae:next / ae:plugin-stats / ae:retrospect) 必须用非递归 glob `output.reviews/*.md` 扫，从而自然排除 `output.reviews/adhoc/` 子目录里的 ad-hoc review。本测试是 enforced cross-skill contract guard —— 如果未来任何一个 reader skill 改成递归 glob (`**/*.md`)，本测试 fail，强制 reviewer 知会 contract 影响。

## Prompt

For each of the four review-reading skill files, answer:

1. `plugins/ae/skills/dashboard/SKILL.md` — what glob pattern does it use to scan reviews? Is it recursive (`**`) or non-recursive (`*.md`)?
2. `plugins/ae/skills/next/SKILL.md` — same question.
3. `plugins/ae/skills/plugin-stats/SKILL.md` — same question.
4. `plugins/ae/skills/retrospect/SKILL.md` — same question.

Quote the exact glob pattern from each file. State PASS/FAIL per skill: PASS if pattern is `output.reviews/*.md` (or equivalent non-recursive form); FAIL if pattern is `output.reviews/**/*.md` or any recursive descent that would surface `output.reviews/adhoc/*.md` files.
