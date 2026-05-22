---
id: trace-no-agent-teams-check
target: ae:trace
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Pre-check section contains the `pipeline.yml` exists check (item 1 of original Pre-check is preserved)

### MUST_NOT
- [text:contains] SKILL.md Pre-check section contains the string `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (verified by extracting `## Pre-check` section via `awk '/^## Pre-check/,/^## /'` and grepping)
- [text:contains] SKILL.md Pre-check section contains `Agent Teams unavailable, running solo` warning text
- [text:contains] SKILL.md Pre-check section contains `auto-fallback` clause
- [text:contains] SKILL.md Pre-check section contains a numbered item with `Agent Teams` as the heading

### SHOULD
- [text:contains] SKILL.md other sections (e.g., Step 3 Agent Teams Analysis) MAY still reference Agent Teams — only the Pre-check section is gated
- [behavior] `/ae:trace` execution does not print any Agent Teams warning under solo conditions
