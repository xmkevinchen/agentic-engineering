---
id: analyze-refuse-no-agent-teams
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md pre-check mentions auto-fallback when Agent Teams not enabled
- [text:contains] SKILL.md contains warning message about running solo
- [behavior] When Agent Teams disabled, skill proceeds with TL executing directly (auto-fallback)

### MUST_NOT
- [behavior] MUST NOT hard-block execution when Agent Teams is disabled (ae:analyze is auto-fallback tier)

### SHOULD
- [text:contains] Warning mentions cross-family and parallel review disabled
