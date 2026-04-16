---
id: trace-write-tool-required
target: ae:trace
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md explicitly states the Write tool MUST be called to save the output file
- [text:contains] SKILL.md states "Displaying results in conversation is not sufficient"
- [text:contains] SKILL.md writes output to pipeline.yml → output.analyses directory as NNN-trace-slug.md

### MUST_NOT
- [behavior] MUST NOT only display trace results in conversation without writing to disk
- [behavior] MUST NOT skip the Write tool call for trace output persistence

### SHOULD
- [text:contains] File naming convention uses NNN-trace-slug.md format
