---
id: analyze-team-correct-agents
target: ae:analyze
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Teammates are spawned via the Agent tool (each with a `name`), no TeamCreate
- [behavior] Exactly three core agents spawned: archaeologist, standards-expert, challenger
- [behavior] All three agents use `run_in_background: true`
- [behavior] All three agents send findings back to team-lead via SendMessage before shutdown (shutdown_request/shutdown_response; no TeamDelete)

### MUST_NOT
- [behavior] No codex-proxy agent spawned (cross_family disabled in test context)
- [behavior] No gemini-proxy agent spawned (cross_family disabled in test context)

### SHOULD
- [behavior] Each spawned teammate is named for its role (e.g. `archaeologist`), making it addressable via SendMessage
