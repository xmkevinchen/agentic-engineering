---
id: setup-six-output-slots-default
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md fill in output block with all 6 slots: discussions, plans, milestones, backlog, reviews, analyses
- [text:contains] SKILL.md default for discussions is ".ae/discussions/"
- [text:contains] SKILL.md default for plans is ".ae/plans/"
- [text:contains] SKILL.md default for milestones is ".ae/milestones/"
- [text:contains] SKILL.md default for backlog is ".ae/backlog/"
- [text:contains] SKILL.md default for reviews is ".ae/reviews/"
- [text:contains] SKILL.md default for analyses is ".ae/analyses/"

### MUST_NOT
- [behavior] MUST NOT omit any of the 6 required output slots
- [behavior] MUST NOT use custom paths when defaults apply and no existing directories differ

### SHOULD
- [text:contains] SKILL.md scans existing project directories to adjust slot values when non-default locations are found
