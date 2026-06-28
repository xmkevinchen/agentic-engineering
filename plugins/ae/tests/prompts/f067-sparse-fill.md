---
id: f067-sparse-fill
target: ae:review
layer: 1
source: F-067
---

## Context
- `plugins/ae/skills/review/SKILL.md` §0–§3 define F-067 sparse-fill lens selection.
- The review floor (challenger + code-reviewer, → `baseline_lenses`) always runs.
- Specialist lenses (security / performance / architecture) are ADDED on positive diff evidence (`soft_added_lenses`) or forced by the deterministic risk-floor (`risk_floor_lenses`).
- Scenario diff under review: a **game-core** change — only gameplay/render/input source files (e.g. `src/game/render.go`, `src/game/input.go`, `src/game/physics.go`). NO file matches `work.security_patterns`. NO authentication, secrets, DB-migration, network-boundary, or perf-hot-path code is touched. This is the F-067 "G1" motivating case.

## Prompt
Per `review/SKILL.md` §3 sparse-fill, when `/ae:review` selects lenses for this game-core diff, which specialist lenses does the soft-add put into `soft_added_lenses`, and what is `final_lenses`? Does the skill's selection rule correctly REFRAIN from adding `security`/`performance` here?
(static analysis of the skill's selection rule against the scenario — no execution required)
