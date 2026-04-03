---
id: test-plugin-blind-protocol-defined
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- SKILL.md for ae:test-plugin is readable

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- SKILL.md defines blind protocol info flow (TL reads only frontmatter + prompt + context)
- SKILL.md defines judge protocol (raw output/artifacts sent to judge for evaluation)
- SKILL.md specifies judge selection options (codex/gemini/claude)

### MUST_NOT
- Blind protocol allows TL to read Expected Behavior section during execution (except --verbose mode)
