---
id: tp-refuse-unreachable-judge
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` has `test_plugin.judge: gemini` configured
- Gemini MCP server (`mcp__plugin_ae_gemini__chat`) is not available in the session

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin ae:work
