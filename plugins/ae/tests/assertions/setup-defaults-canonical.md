---
id: setup-defaults-canonical
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] setup/SKILL.md Output Defaults table shows `output.discussions` default as `.ae/discussions/`
- [text:contains] setup/SKILL.md Output Defaults table shows `output.plans` default as `.ae/plans/`
- [text:contains] setup/SKILL.md Output Defaults table shows `output.milestones` default as `.ae/milestones/`
- [text:contains] setup/SKILL.md Output Defaults table shows `output.backlog` default as `.ae/backlog/`
- [text:contains] setup/SKILL.md Output Defaults table shows `output.reviews` default as `.ae/reviews/`
- [text:contains] setup/SKILL.md Output Defaults table shows `output.analyses` default as `.ae/analyses/`
- [text:contains] setup/SKILL.md notes that defaults are GTD-first canonical (Plan 050+)

### MUST_NOT
- [text:contains] No `(default: docs/<slot>/)` parenthetical statements anywhere in plugins/ae/skills/ for output.* slots
- [text:contains] Setup Output Defaults table does NOT contain `docs/<slot>/` in any default cell

### SHOULD
- [text:contains] External-project legacy override path documented (docs/* → output.* slot)
