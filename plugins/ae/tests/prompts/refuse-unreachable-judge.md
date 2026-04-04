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
