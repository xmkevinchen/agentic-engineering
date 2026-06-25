---
id: work-code-review-inline-no-teamcreate
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] ae:work Check D says to execute `/ae:code-review` inline by reading its SKILL.md and following its instructions within the current context
- [behavior] ae:code-review SKILL.md does not spawn NAMED teammates via the `Agent` tool — its sole `Agent()` call (Track 4 Doodlestein) is an anonymous subagent with no `name:` param, so review runs inline, not as Agent-Teams teammates

### MUST_NOT
- [behavior] MUST NOT have ae:code-review SKILL.md spawn teammates for review execution (no `Agent` spawn with a `name` parameter for the review)
- [behavior] MUST NOT spawn ae:code-review as a separate Agent Team — the review runs in the current context (inline)
