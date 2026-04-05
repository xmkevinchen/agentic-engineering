---
id: analyze-team-correct-agents
target: ae:analyze
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] TeamCreate is called with a team name containing the analysis topic
- [behavior] Exactly three core agents spawned: archaeologist, standards-expert, challenger
- [behavior] All three agents use `run_in_background: true`
- [behavior] All three agents send findings back to TL (Lead) via SendMessage before team shutdown

### MUST_NOT
- [behavior] No codex-proxy agent spawned (cross_family disabled in test context)
- [behavior] No gemini-proxy agent spawned (cross_family disabled in test context)

### SHOULD
- [behavior] Team name follows the pattern `<topic>-analyze`
