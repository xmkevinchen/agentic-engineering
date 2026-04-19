---
id: layer2-governance-prefer-stack-kill
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Expected Behavior

### MUST
- [team:exists] Spawned team config.json members[] array does NOT contain `name: phpstan-expert` — agent suppressed despite prefer rule match
- [behavior] Debug output (or team-lead synthesis) documents the suppression reason specifically citing the noise-floor strong-stack-mismatch-kill rule — not a generic "agent not selected" explanation
- [behavior] Debug output notes that Rule 4 (prefer phpstan-expert for [security, audit]) DID match at Layer 1, AND that the +0.20 bonus WAS applied, AND that the bonus was then overridden by the stack-mismatch kill. The three-step chain is observable — if debug output shows only "not selected" without the force→bonus→kill sequence, the implementation has skipped the intended diagnostic path.

### MUST_NOT
- [team:exists] MUST NOT include `phpstan-expert` in the team — a PHP/Laravel expert on a Rust/MCP project is the exact silent-failure mode this test guards against
- [behavior] MUST NOT suppress the agent silently — the suppression reason MUST be visible in debug output OR in the team-lead synthesis narrative (which consumes the debug trace). Silent suppression = assertion fails.

### SHOULD
- [behavior] If `--agent-debug` is used, output includes a structured annotation resembling: `phpstan-expert — score after prefer bonus: 0.XX + 0.20 = 0.YY → SUPPRESSED (suppression_rule: strong-stack-mismatch-kill; agent stack [php, laravel] not in project stack [rust, mcp])`
- [behavior] Suppression message suggests concrete follow-up: user can `--detach phpstan-expert` or rewrite the prefer rule's context to be less broad, IF phpstan-expert is genuinely wanted on this project
