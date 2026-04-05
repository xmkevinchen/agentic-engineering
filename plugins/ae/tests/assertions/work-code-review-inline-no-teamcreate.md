---
id: work-code-review-inline-no-teamcreate
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] ae:work Check D says to execute `/ae:code-review` inline by reading its SKILL.md and following its instructions within the current context
- [text:contains] ae:code-review SKILL.md contains no `TeamCreate` call anywhere in the file

### MUST_NOT
- [behavior] MUST NOT have ae:code-review SKILL.md create a named team (no `team_name` parameter for review execution)
- [behavior] MUST NOT spawn ae:code-review as a separate Agent Team — the review runs in the current context (inline)
