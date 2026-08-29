---
description: Directory guide — how roles under agents/ are read and spawned. Not an agent definition.
---

# Roles

Every `.md` file under this directory defines one role an agent can be spawned
into. The frontmatter `description` says what the role is for; the body is the
role's instructions. Spawn one as `subagent_type: "ae:<subdir>:<filename>"` —
e.g. `agents/review/code-reviewer.md` → `ae:review:code-reviewer`.

Subdirectories group by function: `review/` judges finished work, `research/`
establishes facts, `workflow/` fills process seats (cross-family proxies,
adversarial close-out), `engineering/` implements.

Pick by reading descriptions, not by convention. A project can add its own
roles under `.claude/agents/`; prefer a project role over an AE one when both
fit.
