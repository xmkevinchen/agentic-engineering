---
id: layer2-governance-prefer-stack-kill
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Expected Behavior

### MUST
- [team:exists] Spawned team config.json members[] array does NOT contain `name: phpstan-expert` — agent filtered in Layer 1 step 2 (stack-mismatch hard constraint) before Claude saw the candidate pool
- [behavior] Layer 1 trace (via `--agent-debug` or team-lead synthesis report) documents the chain: (a) prefer rule 4 **fired** on `phpstan-expert` for [security, audit], (b) stack-mismatch **filtered** `phpstan-expert` because `tech_stack: [php, laravel]` is disjoint from project `tech_stack: [rust, mcp]`, (c) prefer annotation had nothing to attach because the agent was already removed. This is AE's Layer 1 audit trace, NOT Claude's own reasoning — Claude never saw `phpstan-expert` in its input pool.

### MUST_NOT
- [team:exists] MUST NOT include `phpstan-expert` in the team — a PHP/Laravel expert on a Rust/MCP project is the exact silent-failure mode this test guards against
- [behavior] MUST NOT suppress the agent silently — the Layer 1 trace MUST show both the prefer-fired event AND the stack-mismatch-filter event. An implementation that skips the filter (spawning `phpstan-expert`) or skips the trace logging (team-lead has no record of the rule chain) fails the assertion.

### SHOULD
- [behavior] If `--agent-debug` is used, trace includes a structured annotation resembling: `rule-4 (prefer phpstan-expert for [security, audit]): FIRED | stack-mismatch filter: REMOVED phpstan-expert (agent tech_stack [php, laravel] ⊄ project tech_stack [rust, mcp]) | prefer annotation: NO-OP (target already filtered)`
- [behavior] Trace message suggests concrete follow-up: user can `--detach phpstan-expert` or rewrite the prefer rule's context to be less broad, IF phpstan-expert is genuinely wanted on this project
