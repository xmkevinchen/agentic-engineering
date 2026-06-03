---
id: work-autopass-plain-language
target: ae:work
layer: 1
source: regression
---

## Context

F-037 translated `plugins/ae/skills/work/SKILL.md`'s user-facing auto-pass gate output into plain language while leaving the gate's internal expression and the step-summary sentinel fields untouched.

## Prompt

Static analysis of `plugins/ae/skills/work/SKILL.md`: verify the plain-language auto-continue line persists, the internal gate expression is intact, and the `Actual files:` sentinel is untouched.
