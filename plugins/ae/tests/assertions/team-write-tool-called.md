---
id: team-write-tool-called
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] Write tool is called to save the team output file
- [text:regex] Output filename matches pattern `\d{3}-team-[\w-]+\.md`

### MUST_NOT
- [behavior] MUST NOT only display results in conversation without writing to a file
