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

Per Layer 1 flow in `plugins/ae/skills/agent-selection/SKILL.md` (strict step order):
1. **Force apply** — none firing (rule 1 targets different context)
2. **Hard-constraint filter** — stack-mismatch removes `phpstan-expert` from the pool: agent declares `tech_stack: [php, laravel]`, project declares `tech_stack: [rust, mcp]` → disjoint → filtered BEFORE Claude sees the pool
3. **Prefer annotate** — rule 4 fires on context [security, audit], but `phpstan-expert` is already gone from the pool; prefer annotation is a no-op (Layer 1 trace records this)
4. **Claude picks** — from the filtered pool (no `phpstan-expert` in it)
5. Final behavior: `phpstan-expert` NOT SPAWNED; the Layer 1 trace shows rule 4 fired but was defeated by the stack-mismatch filter

This is the silent-failure mode from review 042 F1 — if the implementation is wrong, Claude could follow the `prefer` hint past the stack-mismatch filter and spawn a PHP expert on a Rust/MCP project.

## Prompt

```
/ae:discuss "security audit of Rust MCP module — tool-authentication flows"
```

Expected: team composition does NOT include `phpstan-expert` (excluded by stack-mismatch hard constraint). Debug output (if `--agent-debug`) shows Rule 4 matched and surfaced `phpstan-expert` as a prefer hint, but the hard-constraint filter removed it before Claude's Layer 2 pick.
