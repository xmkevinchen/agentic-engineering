---
id: refuse-unreachable-judge
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with `test.judge` configured
- Gemini MCP server is not running or unreachable

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin ae:review

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
