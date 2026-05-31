---
id: review-paused-to-done
target: ae:review
layer: 1
source: regression
---

## Context
F-032 D7: a paused feature that is reviewed and passes is complete → archives to `done/`. The review archive (Phase 2) must derive its source state dir dynamically (active OR paused), not hardcode `active`.

## Prompt
Read `plugins/ae/skills/review/SKILL.md` Feature-level archive trigger (Phase 2). Confirm whether the archive `mv` source dir is hardcoded `active/` or derived dynamically from the plan path's state segment, and what happens to a paused feature on `verdict: pass` vs `verdict: fail`.
