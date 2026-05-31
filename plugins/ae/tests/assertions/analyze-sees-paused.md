---
id: analyze-sees-paused
target: ae:analyze
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/analyze/SKILL.md] Pre-check ensures `.ae/features/paused/` exists (mkdir-on-demand, not a Stop condition).
- [file:contains:plugins/ae/skills/analyze/SKILL.md] The F-NNN allocator scans `.ae/features/{active,done,abandoned,paused}/F-*/index.md` (so a paused feature's ID is not reused — avoids duplicate IDs).
- [file:contains:plugins/ae/skills/analyze/SKILL.md] The already-promoted (double-promote) check scans `.ae/features/{active,done,abandoned,paused}/*/index.md`.
- [file:contains:plugins/ae/skills/analyze/SKILL.md] A `paused/` soft-refuse branch exists for a BL already promoted to a paused feature (resume instead of re-promote).

### MUST_NOT
- [file:not_contains:plugins/ae/skills/analyze/SKILL.md] An F-NNN allocator or double-promote scan limited to the 3-dir `{active,done,abandoned}` (would miss paused features → duplicate IDs / split audit trail).
