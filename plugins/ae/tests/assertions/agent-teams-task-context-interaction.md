---
id: agent-teams-task-context-interaction
target: ae:agent-teams
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] `### H. Team-context interaction (tasks vs teams)` subsection exists in the `## Skill step progress tracking` section
- [text:contains] Behavior documented: tasks created before `TeamCreate` return `Task not found` while the team is active; not lost, accessible again after `TeamDelete`
- [text:contains] Rule 1: `do not retry mid-team` + `reconcile after TeamDelete`
- [text:contains] Rule 2: `batch-create AFTER TeamCreate` qualified as `MUST for new skills, SHOULD-retrofit for existing ones`, with the multi-team exception (e.g. ae:discuss) applying Rule 1
- [text:contains] Precedence line: `canonical rule wins`; per-skill "At skill start" tables update opportunistically
- [text:contains] §C.1 carries the timing nuance pointing to `§H rule 2`
- [text:contains] The section intro points readers to §H before choosing task-creation timing
- [text:contains] `plugins/ae/skills/review/SKILL.md` task table cites `agent-teams §H rule 2` for its after-TeamCreate batch-create (annotation synced to actual execution order)

### MUST_NOT
- [text:not_contains] `plugins/ae/skills/review/SKILL.md` no longer claims `even though spawn happens later — batch-create per agent-teams §C.1` (the stale annotation)

### SHOULD
- [text:contains] Pre-existing subsections `### A.` through `### G.` all still present (additive change only)
- [text:contains] The harness-behavior framing ("not an AE bug — do not fight it") is present
