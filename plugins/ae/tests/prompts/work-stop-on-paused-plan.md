---
id: work-stop-on-paused-plan
target: ae:work
layer: 1
source: regression
---

## Context
F-032 keystone (D4): running `ae:work` on a paused feature's plan in place would leave the feature live-but-classified-paused (a "phantom state"). The guard must soft-warn and STOP, handing over the resume command — not proceed.

## Prompt
Read `plugins/ae/skills/work/SKILL.md`. Confirm what happens when the resolved plan path is under `.ae/features/paused/`: does `ae:work` proceed, or stop and instruct the user to resume (mv to active/) first? Confirm empty-arg inference does not auto-select a paused plan.
