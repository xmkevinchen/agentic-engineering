---
id: work-stop-on-paused-plan
target: ae:work
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/work/SKILL.md] A paused-feature guard: when the resolved plan path is under `.ae/features/paused/`, `ae:work` STOPs and does NOT proceed (F-032 D4 keystone — prevents the phantom state of a feature running live while classified paused).
- [file:contains:plugins/ae/skills/work/SKILL.md] The guard prints the resume command (`mv .ae/features/paused/...` to `active/` + edit index.md status), surfaced inline at point-of-need.
- [file:contains:plugins/ae/skills/work/SKILL.md] A note that empty-arg argument-inference never auto-selects a paused plan (scans `active/` only); the guard catches an explicit paused plan path.

### MUST_NOT
- [file:not_contains:plugins/ae/skills/work/SKILL.md] Any instruction to run / proceed with a paused-feature plan in place (resume = mv to active/ first, never run in paused/).
