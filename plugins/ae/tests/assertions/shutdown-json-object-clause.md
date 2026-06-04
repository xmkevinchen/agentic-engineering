---
id: shutdown-json-object-clause
target: ae:agent-teams, codex-proxy, gemini-proxy
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] The Shutdown handshake (canonical) Behavior list states the response MUST be sent as a JSON **object** in SendMessage's `message` parameter — NOT as a text string
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] The canonical clause explicitly states stringified JSON (even with correct request_id and all fields present) is not parsed by the harness and does NOT terminate the teammate
- [file:contains:plugins/ae/agents/workflow/codex-proxy.md] The `## Shutdown protocol` section contains, below the canonical reference link, a self-contained warning carrying all four concepts: reply as a JSON **object** / not a string / prose and stringified-JSON replies are ignored by the harness / they do NOT terminate the process
- [file:contains:plugins/ae/agents/workflow/gemini-proxy.md] The `## Shutdown protocol` section contains a warning carrying the same four concepts (wording may vary; all four concepts required)
- [behavior] `grep -rF '"type": "shutdown_response"' plugins/ae/agents/` returns zero hits — the proxy warning lines do not embed the sentinel literal (check-shutdown-canonical.sh CI invariant)

### MUST_NOT
- [file:not_contains:plugins/ae/agents/workflow/codex-proxy.md] Any inline shutdown-response schema or example (partial or complete) — the canonical section in agent-teams SKILL.md is the single source; only whitelist-exempt agents (per check-shutdown-canonical.sh SHUTDOWN_EXEMPT) may omit the canonical reference, and no agent may inline the schema
- [file:not_contains:plugins/ae/agents/workflow/gemini-proxy.md] Any inline shutdown-response schema or example (partial or complete) — same single-source rule

### SHOULD
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] The canonical clause includes inline Correct/Wrong examples contrasting object form vs string form
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] The canonical clause cites the observed failure data points (F-037 gemini-proxy prose, F-041 codex-proxy-2 stringified JSON)
- [behavior] `sh plugins/ae/scripts/check-shutdown-canonical.sh` exits 0 and its summary line reports `failures=0` AND `scanned > 0` (a run that scanned zero files is NOT a pass — false-green guard)
