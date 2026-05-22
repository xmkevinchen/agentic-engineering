---
id: trace-no-agent-teams-check
target: ae:trace
layer: 1
source: regression
---

## Context

F-027 Cliff 2 removed the decorative Agent Teams Pre-check from `/ae:trace` — the skill is read-only code-tracing and never spawned a team in either Agent-Teams-enabled or solo mode, so the auto-fallback gate was a no-op WARNING. This fixture regression-proofs the removal: future refactors must not re-introduce an Agent Teams Pre-check item to trace/SKILL.md.

## Prompt

Read the ae:trace SKILL.md and describe its Pre-check section. Confirm whether the Pre-check references the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable.

## Prompt Variants

- Does ae:trace Pre-check require Agent Teams?
- What checks does ae:trace perform before executing?
