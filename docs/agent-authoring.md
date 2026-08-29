# Agent Authoring Guide

Add your own agents to ae. Project agents are auto-discovered and preferred over built-in agents when roles match.

## Minimum Viable Agent

Create a file at `.claude/agents/security-auditor.md`:

```markdown
---
name: security-auditor
description: "Reviews code for security vulnerabilities and auth bypass"
---

You are a security specialist. Focus on OWASP Top 10, authentication flows,
and injection vectors. Cite specific file:line evidence for all findings.
```

That's it. ae discovers it automatically and includes it in review teams.

## How It Works

1. **Discovery**: ae scans `.claude/agents/*.md` at runtime
2. **Role inference**: ae reads your agent's `description` to infer its role:
   - Keywords like "review", "audit", "security" → **reviewer** (joins review teams)
   - Keywords like "implement", "build", "develop" → **developer** (joins work teams)
   - Keywords like "expert", "specialist", "domain" → **domain-expert** (joins analysis/discussion teams)
3. **Precedence**: your project agent is preferred over ae's built-in agent when both match the same role

## Frontmatter Reference

### Required

| Field | Description |
|-------|-------------|
| `name` | Agent identifier. Must match filename (without `.md`) |
| `description` | What this agent does. Used for role inference — include role keywords |

### Optional

| Field | Description | Default |
|-------|-------------|---------|
| `model` | Model override: `opus`, `sonnet`, `haiku` | Inherits from parent |
| `effort` | Reasoning effort: `high`, `medium`, `low` | `medium` |
| `color` | Display color in Agent Teams UI | Auto-assigned |
| `maxTurns` | Auto-stop after N turns | No limit |
| `tools` | Restrict available tools (list) | All tools |
| `skills` | Pre-load skills (list) | None |

See the full [Agent Contract Specification (local-only `docs/decisions/037-agent-contract.md`, untracked by convention) for details.

## Role Taxonomy

| Role | When to use | Team slot |
|------|------------|-----------|
| **reviewer** | Your agent checks code quality, security, performance, or compliance | ae:review, ae:code-review |
| **developer** | Your agent writes or modifies code | ae:work |
| **domain-expert** | Your agent has specialized knowledge (API design, ML, etc.) | ae:analyze, ae:discuss, ae:team |

An agent can match multiple roles. When ambiguous, ae prefers: reviewer → developer → domain-expert.

## Examples

### Security Auditor (reviewer)

```markdown
---
name: security-auditor
description: "Reviews code for security vulnerabilities, authentication bypass, and injection vectors"
model: sonnet
effort: high
color: red
---

You are a security specialist focused on application security.

When reviewing code:
- Check OWASP Top 10 categories systematically
- Focus on authentication flows, session management, and token lifecycle
- Look for injection vectors (SQL, XSS, command injection, path traversal)
- Verify secrets management (no hardcoded credentials, proper env var usage)
- Cite specific file:line evidence for all findings
```

### API Expert (domain-expert)

```markdown
---
name: api-expert
description: "Domain expert in API design, REST conventions, and backend architecture"
model: sonnet
effort: medium
color: cyan
---

You are an API design specialist. Evaluate API contract consistency,
backwards compatibility, error handling, and performance implications.
```

Both examples are available as templates in `plugins/ae/templates/examples/`.

## Testing Your Agent

Verify your agent is discovered:

```
/ae:team review the authentication module
```

ae should show your agent in the team selection. If it doesn't appear:

1. Check the filename matches the `name` field
2. Check the `description` contains role keywords
3. Ensure the file is in `.claude/agents/` (not a subdirectory)

## Advanced: pipeline.yml Override

If your agent is outside `.claude/agents/` or role inference is wrong, declare it explicitly:

```yaml
# In .claude/pipeline.yml
project_agents:
  - name: security-auditor
    role: reviewer
```

This overrides description-based inference. All agents must still be in `.claude/agents/` to be spawnable. See the [Agent Contract Specification (local-only `docs/decisions/037-agent-contract.md`, untracked by convention) for precedence rules.

## Tips

- **Keep descriptions specific** — "Reviews Python code for type safety and mypy compliance" is better than "Checks code"
- **One role per agent** — an agent that reviews AND implements is confusing. Make two agents.
- **Test with `/ae:team`** — verify discovery before relying on it in `/ae:review` or `/ae:work`
- **Start minimal** — add `model`, `effort`, `tools` later as you tune performance
