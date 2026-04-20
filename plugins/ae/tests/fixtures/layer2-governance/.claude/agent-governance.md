# AE Agent Governance (Fixture)

Seeded governance rules for Layer-2 test cases. Each rule exercises a distinct path in Rule 4's 3-layer chain.

```yaml
rules:
  # Rule 1: force + context match → forced agent spawns, bypasses Layer 2+3
  - agent: rust-mcp-expert
    action: force
    context: [mcp, tool-auth]
    scope: discuss
    added_at: 2026-04-18
    added_reason: "Layer-2 fixture: force-match on mcp/tool-auth context"

  # Rule 2: prefer + context match → surfaced to Claude as a hint (no mechanical bonus)
  - agent: security-specialist
    action: prefer
    context: [security, vulnerability]
    scope: review
    added_at: 2026-04-18
    added_reason: "Layer-2 fixture: prefer-match, surfaces agent as context hint"

  # Rule 3: force + broken (agent file missing) → ESCALATE via AskUserQuestion
  - agent: nonexistent-rust-auditor
    action: force
    context: [missing, edge-case]
    scope: all
    added_at: 2026-04-18
    added_reason: "Layer-2 fixture: broken force-rule → expected ESCALATE path"

  # Rule 4: prefer + stack mismatch → surfaced as hint but filtered by hard-constraint (stack-mismatch wins)
  - agent: phpstan-expert
    action: prefer
    context: [security, audit]
    scope: discuss
    added_at: 2026-04-18
    added_reason: "Layer-2 fixture: prefer surfaces agent, stack-mismatch hard constraint removes it before Claude's pick"
```
