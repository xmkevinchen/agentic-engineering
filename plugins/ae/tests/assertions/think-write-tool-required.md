---
id: think-write-tool-required
target: ae:think
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md explicitly states the Write tool MUST be called to save the output file
- [text:contains] SKILL.md states "Displaying results in conversation is not sufficient"
- [text:contains] SKILL.md writes output to pipeline.yml → output.analyses directory as NNN-slug.md

### MUST_NOT
- [behavior] MUST NOT only display analysis in conversation without writing to disk
- [behavior] MUST NOT skip the Write tool call for analysis persistence

### SHOULD
- [text:contains] SKILL.md specifies output file frontmatter with id, title, type: analysis, created, status: done fields
