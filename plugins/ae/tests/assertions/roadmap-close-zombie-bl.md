---
id: roadmap-close-zombie-bl
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] a BL still in `unscheduled/` whose ID is in a **done- or abandoned-**state feature's `origin_bl` is routed to the Tier-1 CLOSE candidate set (not silently dropped)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] a BL whose ID is in an **active** (or paused) feature's `origin_bl` is still excluded (in-progress) — NOT a CLOSE candidate
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] the Terminal-status filter (`status in {promoted, done, closed}`) runs BEFORE origin_bl routing, so a BL already carrying `status: promoted` is excluded before CLOSE evaluation (protects an in-flight feature's own origin BL)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] multi-BL-consolidation list form (`origin_bl: [BL-A, BL-B]`) is normalized — a BL in a done/abandoned list-form origin_bl is equally a Tier-1 zombie
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] a Tier-1 origin_bl match yields CLOSE **deterministically** — it is NOT subject to the "Default to WAIT" rule (that default governs only the PROMOTE/WAIT pool); the LLM only writes the reason, it does not decide CLOSE-vs-WAIT for a Tier-1 zombie
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] multi-state precedence: a BL-ID in BOTH an active/paused AND a done/abandoned feature's `origin_bl` → active/paused PREEMPTS → exclude, never CLOSE (no false-CLOSE of a live origin BL)

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] MUST NOT route an active-feature origin_bl BL to CLOSE (only done/abandoned-state matches are zombies)
