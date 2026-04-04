---
id: team-empty-arguments
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] Prompts user to provide a task description

### MUST_NOT
- [behavior] MUST NOT call TeamCreate with an empty or missing task description
- [behavior] MUST NOT proceed to agent selection without a task

### SHOULD
- [text:contains] Provides example task descriptions to guide the user
