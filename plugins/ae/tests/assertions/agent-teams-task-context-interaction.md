---
id: agent-teams-task-context-interaction
target: ae:agent-teams
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] `### H. Team-context interaction (tasks vs teams)` subsection exists in the `## Skill step progress tracking` section
- [text:contains] Behavior documented: with ONE implicit team per session there is a single task list; spawning teammates does not switch the active list, so step tasks stay accessible for the whole run
- [text:contains] Rule 1: `batch-create at skill start`
- [text:contains] Precedence line: `canonical rule wins`; per-skill tables update opportunistically
- [text:contains] §C.1 carries the timing note pointing to `§H`
- [text:contains] The section intro points readers to §H before choosing task-creation timing

### MUST_NOT
- [text:not_contains] `TeamCreate` or `TeamDelete` referenced as a live task-list-switching mechanism in §H (implicit-team model, no create/delete API)

### SHOULD
- [text:contains] Pre-existing subsections `### A.` through `### G.` all still present (additive change only)
- [text:contains] §H frames the single-task-list-per-session behavior under the implicit-team model
