---
id: refuse-unreachable-judge
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Output contains "not reachable"
- Output contains "Check MCP server status"
- Output mentions the judge name from config

### MUST_NOT
- No TeamCreate tool call
- No test execution proceeds

### SHOULD
- Abort occurs during pre-check phase before any test activity
