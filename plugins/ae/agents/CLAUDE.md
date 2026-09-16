---
description: Directory guide — how roles under agents/ are read and spawned. Not an agent definition.
---

# Roles

Every `.md` file under this directory defines one role an agent can be spawned
into. The frontmatter `description` says what the role is for; the body is the
role's instructions. Spawn one as `subagent_type: "ae:<subdir>:<filename>"` —
e.g. `agents/workflow/codex-proxy.md` → `ae:workflow:codex-proxy`.

`workflow/` is the only subdirectory today: it fills process seats — cross-family
proxies (Codex, Gemini, generic OpenAI-compatible), the same-family discuss seat,
and the four Doodlestein adversarial-close-out readers.

Pick by reading descriptions, not by convention. A project can add its own
roles under `.claude/agents/`; prefer a project role over an AE one when both
fit.
