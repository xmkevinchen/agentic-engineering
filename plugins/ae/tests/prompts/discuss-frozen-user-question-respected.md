---
id: discuss-frozen-user-question-respected
target: ae:discuss
layer: 1
source: regression
---

## Context

F-010 在 `plugins/ae/skills/discuss/SKILL.md` 加入 frozen-section 结构性 fix：framing.md 模板加 `## User Question (Frozen)` section + §1.4 write 约束 + §1.5.1 Frozen-field rule + §1.5.3 verdict format `target:` 字段 + §1.5.3 Rule 1.5 byte-for-byte diff guard。本测试验证这些 spec text 完整存在 + 顺序正确 + 没有 strategic Doodlestein 删除的 recovery path 残留。

## Prompt

Read `plugins/ae/skills/discuss/SKILL.md` and answer the following:

1. Does the Appendix's `framing.md` template contain a `## User Question (Frozen)` section heading? Where does it appear relative to `# Framing — [title]` and `## Problem Statement`?
2. Does the Frozen section's description contain the words "sacred", "immutable", and "do NOT rewrite, paraphrase"?
3. Does the file contain a `### 1.4. Writing the User Question (Frozen) section` sub-section before `### 1.5. Round 0`? What MUST NOT items does it list?
4. Does §1.5.1 contain a `**Frozen-field rule**` block defining "Sacred portion" vs "Mutable scope"? What sections are listed under each?
5. Do all 5 reviewer spawn prompts in §1.5.1 contain the line `Honor the Frozen-field rule defined in §1.5.1 above`? How many total occurrences of that phrase in the file?
6. In §1.5.3, what is the format of the REVISE verdict? Does it include a `target:` field? What values are valid for `target:`?
7. Does §1.5.3 contain a Rule 1.5 ("Frozen-section integrity check")? Where does it appear relative to Rule 1 (Quorum check) and Rule 2 (Any REVISE → halt)?
8. What 2 sequential checks does Rule 1.5 perform? Does it include the phrase "byte-for-byte" or "byte-exact"? Does it explicitly say "Do not judge semantic equivalence" and "wording-only changes are still invalid"?
9. After Rule 1.5's two checks, what happens to invalid verdicts — are they dropped entirely, or can they be rephrased / recovered?
10. Does Rule 2 (TL rewrites framing.md per feedback) include a constraint that `## User Question (Frozen)` section is "byte-for-byte preserved across re-runs"?
11. Does the §1.5.3 Rationale paragraph explain why Rule 1.5 fires before Rule 2?
