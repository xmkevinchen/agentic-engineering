---
id: codex-proxy-effort-discipline
target: codex-proxy
layer: 1
source: regression
---

## Context

F-043 fixes a Haiku proxy protocol failure: codex-proxy spawned without per-call reasoning-effort config inherited `~/.codex/config.toml` `effort=high`, producing multi-minute MCP calls that silently exhausted the proxy's turn budget (turn stuck, proxy unreachable). The plan-review spike (2026-06-03) additionally established that launch-layer `codex mcp-server -c model_reasoning_effort=...` did NOT propagate into tool sessions — per-call `config:` is the only reliable lever. This fixture regression-proofs the F-043 Step 1 prose: per-call MUST rule + `[EFFORT-CONFIRM]` receipt + observed priority chain, all bundled inside the Invocation section. (The agent was subsequently bumped haiku→sonnet in the same release — smoke measured 1/3 haiku adherence to these MUSTs; the rules themselves are model-agnostic.)

## Prompt

Read plugins/ae/agents/workflow/codex-proxy.md and describe: (1) what the agent must pass on every initial `mcp__plugin_ae_codex__codex` call, (2) what it must send to team-lead after the initial call returns, and (3) which configuration layer reliably controls `model_reasoning_effort`.

## Prompt Variants

- What does codex-proxy do if its spawn prompt has no `Reasoning:` line?
- Can the plugin's launch args (`codex mcp-server -c ...`) set the reasoning effort for tool-call sessions?
- When must the `[EFFORT-CONFIRM]` receipt be sent if the initial Codex call fails?
