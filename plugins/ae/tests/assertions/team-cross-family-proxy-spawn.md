---
id: team-cross-family-proxy-spawn
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Creates at least one cross-family proxy (codex-proxy or gemini-proxy)
- [behavior] Cross-family proxy agents have `run_in_background: true`
- [text:contains] Proxy agent prompt includes "SendMessage findings to team-lead when done"

### MUST_NOT
- [behavior] MUST NOT count cross-family proxies toward the 5-agent core limit
