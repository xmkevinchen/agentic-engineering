---
id: tp-refuse-unreachable-judge
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains "not reachable"
- [text:contains] Output mentions the judge name from pipeline.yml config
- [behavior] Skill aborts during pre-check, before any test generation begins

### MUST_NOT
- [behavior] No TeamCreate call issued
- [behavior] No Phase 1 or Phase 2 activity proceeds after judge check fails

### SHOULD
- [text:contains] Output references "Check MCP server status" or equivalent guidance
- [text:contains] Output mentions `pipeline.yml` as the place to change judge config
