# Agent Authoring Guide

How to add a role of your own that an AE stage can spawn.

## The minimum

Create `.claude/agents/security-auditor.md` in your project:

```markdown
---
name: security-auditor
description: "Reviews code for security vulnerabilities, auth bypass, and injection vectors"
---

You are a security specialist. Focus on OWASP Top 10, authentication flows,
and injection vectors. Cite specific file:line evidence for every finding.
```

That is the whole contract. Claude Code discovers the file; nothing in AE has to
be told about it.

## How a stage reaches it

**Claude Code does the discovery, not AE.** The host loads `.claude/agents/*.md`
in your project and makes each one spawnable by its `name`. AE has no registry,
no scan and no role-inference table — there is nothing to register with.

**A stage picks a role by reading descriptions, and casts it at spawn time.** When
a stage needs fresh eyes or an independent judgment, it chooses among the roles
the session offers — AE's own, under `plugins/ae/agents/`, and yours — by reading
what each `description` says it is for, then tells the spawned agent its role,
what to read, and the one question it must answer. **Where a project role and an
AE role both fit, the project role is preferred**; that rule lives in
[`plugins/ae/agents/CLAUDE.md`](../plugins/ae/agents/CLAUDE.md).

Two consequences for how you write the file:

- **The `description` is load-bearing.** It is the only thing read when choosing.
  "Reviews Python code for type safety and mypy compliance" gets picked for the
  right work; "Checks code" does not get picked at all.
- **The body is instructions, not identity.** It is read by the spawned agent,
  after the spawn prompt has already told it what job it is doing here.

## Frontmatter

The authoritative field list — including which fields a *plugin* agent may not
set — is [`references/claude-code-plugin-api.md`](references/claude-code-plugin-api.md).
In practice a project agent needs `name`, `description`, and often `tools`,
`model` and `effort`.

Three fields deserve a warning, because a field that does nothing looks exactly
like a field that works:

| Field | What was measured |
|---|---|
| `skills` | Documented as preloading a skill's full content. A plugin agent that set it received only the one-line description every skill gets anyway. Untested for project agents; do not rely on it. |
| `omitClaudeMd` | Not a supported field. A plugin agent that set it still received the whole CLAUDE.md hierarchy. Removed from AE's own definitions. |
| `vibe` | Appears in no published field list, is read by nothing, and was measured absent from a spawned agent's context. Still present on 13 of AE's own definitions and queued for removal. |

## Keep it small

AE's own convention, and a good default for yours: **one role per agent** — an
agent that both reviews and implements is confusing, so make two — and **under
~100 lines**. Past that, reviewer reliability degrades and spawn-time context is
spent on prose the agent did not need.

Two worked examples ship with the plugin:
[`security-auditor.md`](../plugins/ae/templates/examples/security-auditor.md) and
[`api-expert.md`](../plugins/ae/templates/examples/api-expert.md), alongside
[`agent-template.md`](../plugins/ae/templates/agent-template.md).

## Check that it exists

The host resolves agents by name. Ask for yours directly in any session:

```
Use the security-auditor agent to review the authentication module
```

If it does not appear:

1. the `name` field must match the filename stem;
2. restart the session — agent definitions are read once at session start.

One further precedence fact worth knowing: a project agent whose `name` matches
an AE one **replaces** it outright, rather than sitting beside it. That is the
supported way to swap out a built-in role.
