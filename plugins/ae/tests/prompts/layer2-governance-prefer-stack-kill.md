---
id: layer2-governance-prefer-stack-kill
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Context

Run inside the fixture project. Fixture has:
- Project tech_stack: `[rust, mcp]` (from fixture's pipeline.yml)
- `phpstan-expert` project agent with tech_stack `[php, laravel]` (mismatch)
- `.claude/agent-governance.md` Rule 4: `prefer phpstan-expert for context [security, audit] in scope discuss`

Per scorer spec (`agent-selection-scorer.md`):
1. Rule 4 fires at Layer 1 because context keywords "security" + "audit" match (topic below)
2. `prefer` adds +0.20 bonus to Layer 2 scoring — per revised scoring order, the bonus applies BEFORE noise-floor mitigations
3. Strong-stack-mismatch kill rule (Layer 2 noise-floor): if agent declares tech_stack NOT in project stack AND lacks generalist indicators, drop entirely regardless of positive score
4. `phpstan-expert`'s description is PHP/Laravel-specific → no generalist indicators → strong-stack-mismatch kill wins
5. Final behavior: `phpstan-expert` SUPPRESSED despite the +0.20 prefer bonus

This is the silent-failure mode from review 042 F1 — if the implementation is wrong, the prefer bonus could override the stack-mismatch kill and spawn a PHP expert on a Rust/MCP project.

## Prompt

```
/ae:discuss "security audit of Rust MCP module — tool-authentication flows"
```

Expected: team composition does NOT include `phpstan-expert` (suppressed by strong-stack-mismatch kill). Debug output (if `--agent-debug`) shows Rule 4 matched but was killed by stack-mismatch, with the +0.20 bonus noted but overridden.
