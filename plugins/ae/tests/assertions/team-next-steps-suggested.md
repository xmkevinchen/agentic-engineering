---
id: team-next-steps-suggested
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Next Steps section defines suggestions based on output type
- [behavior] After team execution, provides follow-up suggestions to the user
- [behavior] Suggestions are contextual: analysis output → discuss/plan, implementation → review/code-review, new questions → think/analyze

### MUST_NOT
- [behavior] MUST NOT end without any follow-up suggestions

### SHOULD
- [text:contains] Suggestions reference specific ae skill names (e.g., `/ae:discuss`, `/ae:plan`, `/ae:review`, `/ae:think`)
