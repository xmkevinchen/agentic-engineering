---
id: trace-mode-determination-flow-deps
target: ae:trace
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md defines two modes: "flow" (execution path) and "deps" (structural dependencies)
- [behavior] SKILL.md Step 1 says to ask user if mode is not obvious from context
- [text:contains] SKILL.md describes "flow" as request→response or function call chain tracing
- [text:contains] SKILL.md describes "deps" as imports, inheritance, data flow mapping

### MUST_NOT
- [behavior] MUST NOT silently assume a mode without checking context or asking user

### SHOULD
- [text:contains] SKILL.md output format differs between flow mode (linear chain diagram) and deps mode (tree diagram)
