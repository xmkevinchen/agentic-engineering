---
id: shutdown-json-object-clause
target: ae:agent-teams, codex-proxy, gemini-proxy
layer: 1
source: regression
---

## Context

F-043 fixes the second Haiku proxy protocol failure: a shutdown_response sent as a *string* (prose or stringified JSON — even with all fields present and the correct request_id) is not parsed by the harness and does not terminate the teammate, so shutdown fails repeatedly (observed twice: F-037 gemini-proxy prose ×3, F-041 codex-proxy-2 stringified-JSON ×2). F-043 Step 2 adds a JSON-object clause to the canonical Shutdown handshake section and a self-contained warning line under both proxies' canonical reference link (reference links alone contributed ≈0 to running-Haiku compliance in both incidents). This fixture regression-proofs both edits plus the agents-dir sentinel invariant.

## Prompt

Read plugins/ae/skills/agent-teams/SKILL.md § Shutdown handshake (canonical), and the `## Shutdown protocol` sections of plugins/ae/agents/workflow/codex-proxy.md and plugins/ae/agents/workflow/gemini-proxy.md. Describe in what form a teammate must send its shutdown response, and what happens to prose or stringified-JSON replies.

## Prompt Variants

- Is a shutdown response with all fields correct but sent as a JSON string accepted by the harness?
- What do the codex-proxy and gemini-proxy definitions say beneath their canonical shutdown reference link?
- Do any agent definition files inline the shutdown response JSON schema?
