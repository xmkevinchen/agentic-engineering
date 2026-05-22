---
id: work-agent-teams-fallback-documented
target: ae:work
layer: 1
source: manual
---

## Context

- `/ae:work` Check 3 (Agent Teams) performs a runtime probe of session environment to determine `AGENT_TEAMS_FULL`. When the probe indicates the param `run_in_background` is not available (or the env var is unset), `/ae:work` enters a documented auto-fallback path: solo mode, no parallel spawns, user-visible WARNING, Lead-direct TDD execution.
- The fallback path is a critical safety surface: if a future refactor of `/ae:work` SKILL.md accidentally deletes or weakens the documented fallback, AE-on-AE self-repair workflows running under degraded Agent Teams conditions would silently behave incorrectly.
- This is a Layer 1 STATIC fixture — it verifies that the prose documenting the fallback path persists in `/ae:work` SKILL.md across refactors. Layer 2 dynamic verification (actual runtime exercise of the fallback path with injected `AGENT_TEAMS_FULL=false`) is deferred (BL-091 — env-var-injection mechanism needed for test-plugin Layer 2 dynamic exercise; reopen trigger: any production fallback bug OR 2026-09-01 deadline).
- Two of the five MUST assertions below are **structurally bounded** — they require the named string to appear within or in close proximity to the Check 3 section heading in `work/SKILL.md`. This narrows the invariant from "text exists anywhere in file" to "text exists in correct structural location" (Doodlestein-strategic R2 integration).

## Prompt

How does `/ae:work` SKILL.md document its AGENT_TEAMS_FULL=false auto-fallback path: where do the variable name, the user-visible warning, the solo-mode TDD execution path, and the outcome-statistics degradation surface live in the spec?
