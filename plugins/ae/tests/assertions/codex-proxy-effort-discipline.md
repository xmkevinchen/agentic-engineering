---
id: codex-proxy-effort-discipline
target: codex-proxy
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] A MUST-level rule, located between the `## Invocation` heading and the next `###` heading (bundled with the call-site — the F-043 design point for Haiku compliance), that every **initial** `mcp__plugin_ae_codex__codex` call includes the `config:` parameter with `"model_reasoning_effort"`
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] The rule states: no `Reasoning:` line in the spawn prompt → use `medium`, with no exceptions
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] The proxy passes the TL-supplied `Reasoning:` level through to the initial call's `model_reasoning_effort` — it routes the spawn-prompt value, not a hardcoded constant (`medium` is only the absent-line fallback)
- [behavior] `grep -c -F '[EFFORT-CONFIRM]'` on plugins/ae/agents/workflow/codex-proxy.md returns exactly 2 — once in the receipt rule, once in the inline example (count pinned by F-043 AC1(b))
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] The receipt rule states the `[EFFORT-CONFIRM]` SendMessage to team-lead must be sent after the initial call returns — even on failure — and before any synthesis
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] The priority-chain wording states launch-layer `-c` overrides did NOT propagate into tool sessions (per-call `config:` > `~/.codex/config.toml`), scoped as locally observed / installed-version behavior rather than universal semantics

### MUST_NOT
- [file:not_contains:plugins/ae/agents/workflow/codex-proxy.md] Any claim — under any phrasing — that launch-layer `-c` args or plugin.json launch args reliably control or set the reasoning effort for tool-call sessions

### SHOULD
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] Troubleshooting section mentions rollout logs (`~/.codex/sessions/<date>/rollout-*.jsonl`) for three-way diagnosis when no effort receipt arrives (config not passed / call never returned / agent died after call)
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] Troubleshooting notes `RUST_LOG=codex_mcp_server=debug` goes to stderr and must not pollute stdout (MCP protocol channel)
