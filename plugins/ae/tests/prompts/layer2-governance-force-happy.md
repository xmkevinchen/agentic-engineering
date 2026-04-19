---
id: layer2-governance-force-happy
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Context

Run inside the fixture project (`plugins/ae/tests/fixtures/layer2-governance/` as project root). Fixture has:
- `rust-mcp-expert` project agent (role: domain-expert, tech_stack: [rust, mcp])
- `.claude/agent-governance.md` Rule 1: `force rust-mcp-expert for context [mcp, tool-auth] in scope discuss`

The governance chain at Layer 1 should match the rule (context keywords "mcp" and "tool-auth" appear in the topic below), force-spawn `rust-mcp-expert` into the team, and bypass Layer 2 scoring + Layer 3 user-pick for that agent's slot.

## Prompt

```
/ae:discuss "MCP tool-auth design — threat model for token passthrough to downstream tools"
```

Expected: discussion starts, team composition includes `rust-mcp-expert` (forced by Rule 1). Other agents may or may not appear per normal Rule 4 Layer 2 scoring — the assertion only gates on `rust-mcp-expert` presence + force-path annotation in debug output.
