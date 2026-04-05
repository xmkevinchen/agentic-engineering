---
id: analyze-cross-family-agents
target: ae:analyze
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Team includes a codex-proxy agent
- [behavior] Team includes a gemini-proxy agent
- [behavior] Team also includes core agents: archaeologist, standards-expert, challenger
- [behavior] Both codex-proxy and gemini-proxy agents send findings to team-lead via SendMessage
- [file:contains] analysis.md contains a `### Challenges & Disagreements` section that incorporates cross-family input

### MUST_NOT
- [behavior] Cross-family proxies MUST NOT be omitted when cross_family is enabled in pipeline.yml

### SHOULD
- [behavior] Both proxy agents use `run_in_background: true`
- [behavior] Proxy agents apply Proxy Timeout Protocol from Agent Selection Reference
