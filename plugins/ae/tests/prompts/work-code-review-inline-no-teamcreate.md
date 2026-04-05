---
id: work-code-review-inline-no-teamcreate
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- SKILL.md for ae:code-review is readable
- ae:work calls ae:code-review inline (reads its SKILL.md and follows its instructions)
- ae:code-review runs in the caller's context, not as a separate team
- ae:code-review SKILL.md must NOT contain a `TeamCreate` call

## Prompt
(static analysis — read both ae:work SKILL.md and ae:code-review SKILL.md)

## Prompt Variants
- Variant: verify ae:code-review SKILL.md contains no `TeamCreate` instruction
- Variant: verify ae:work references ae:code-review as inline execution, not team-based
