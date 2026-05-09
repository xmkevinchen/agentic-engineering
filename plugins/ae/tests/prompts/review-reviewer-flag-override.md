---
id: review-reviewer-flag-override
target: ae:review
layer: 1
source: regression
---

## Context

F-012 在 `plugins/ae/skills/review/SKILL.md` 加 `--reviewer <name>` flag。语义：override（NOT additive）—— 列了 flag 就跳过 default selection table，spawn 仅指定 reviewers。flag 可重复（multi-flag 间 additive，但整体 override default）。Unknown name → hard fail。orthogonal to `<target>` argument。本测试验证语义 spec 完整 + 给出 WRONG/CORRECT 例子澄清 + scale anchor 解释默认 4-5 reviewers + forward-reference 提到 `--add-reviewer` deferred。

## Prompt

Read `plugins/ae/skills/review/SKILL.md` `--reviewer flag` section and answer:

1. What is the override semantic — additive (adds to default) or override (replaces default)? Quote the exact phrase that defines this.
2. Are multiple `--reviewer` flags allowed? What happens with `--reviewer X --reviewer Y` — additive between flags?
3. Does the spec contain explicit WRONG / CORRECT examples? What does the WRONG example look like and what does the CORRECT example look like?
4. Does the spec quantify how many reviewers the default selection table typically spawns? (e.g., "4-5 reviewers")
5. What concrete examples follow the scale anchor — what is dropped when user passes `--reviewer challenger` alone?
6. Is there a forward-reference to a future additive variant flag? What is the proposed name and version?
7. What happens with an invalid reviewer name (e.g., typo, agent that doesn't exist)? Hard fail or silent skip?
8. Is `--reviewer` flag combinable with `<target>` argument? Quote the example if any.
9. Does the spec say `--reviewer` is NOT added to ae:code-review? What is the reason?
10. When `--reviewer` flag is present, where does the review write target go (case (a) feature-dir, case (b) legacy, case (c) adhoc)?
