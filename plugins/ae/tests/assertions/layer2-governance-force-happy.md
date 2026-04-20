---
id: layer2-governance-force-happy
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Expected Behavior

### MUST
- [team:exists] Spawned team config.json members[] array contains an entry with `name: rust-mcp-expert` (filename-stem resolution per agent contract)
- [behavior] Team spawn debug output (either `--agent-debug` transcript or team-lead synthesis mention) shows Rule 1 matched via context keywords `mcp` + `tool-auth` AND the match fired at Layer 1 (not Layer 2 score-based inclusion)
- [behavior] The reasoning chain for `rust-mcp-expert`'s inclusion cites the governance force rule, NOT Claude's Layer 2 judgment

### MUST_NOT
- [behavior] Claude's Layer 2 judgment for `rust-mcp-expert` must NOT be the reason-of-record for inclusion (a force rule bypasses Layer 2; if Layer 2 reasoning is cited as the reason, Layer 1 was skipped)
- [team:exists] MUST NOT spawn `phpstan-expert` (prefer rule is scope: discuss + context [security, audit] — topic is mcp/tool-auth, not a match)

### SHOULD
- [behavior] If `--agent-debug` flag is used, output includes an explicit Layer 1 annotation like `[ae:governance] Layer 1 rule matched: force rust-mcp-expert for [mcp, tool-auth]`
