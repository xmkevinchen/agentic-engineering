---
id: discuss-spawns-team-creates-scaffold
target: ae:discuss
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [file:exists] Discussion `index.md` created after Setup step at one of: `<feature-dir>/discussions/<NNN>-<slug>/index.md` (Plan 051+ feature-internal) OR `output.discussions/<NNN>-<slug>/index.md` (legacy fallback for free-text invocations not tied to a feature).
- [file:contains] index.md frontmatter has `status: active`
- [file:contains] index.md frontmatter has `pipeline.discuss: in_progress`
- [file:exists] At least one `topic-NN-slug/summary.md` created
- [file:contains] topic summary.md has `status: pending` in frontmatter
- [team:exists] At least one teammate spawned via the Agent tool (addressable `name` param), no TeamCreate (one implicit team per session; inbox dir exists under ~/.claude/teams/)
- [behavior] Team has TL (moderator) role + at least one role agent spawned as teammate

### MUST_NOT
- [file:exists] MUST NOT pre-populate `topic-NN-slug/summary.md` with A/B/C option choices (options emerge from team discussion per ae:discuss design)
- [behavior] MUST NOT skip the Setup → Spawn Teammates sequence (scaffold before spawning, not parallel)

### SHOULD
- [text:contains] Output confirms Discussion N created with topic count
- [file:contains] index.md lists topics in a table with `status: pending` and empty `decision:` column
- [behavior] Team Discussion Mode (all equal participants, no forced FOR/AGAINST) per ae:agent-teams protocol
