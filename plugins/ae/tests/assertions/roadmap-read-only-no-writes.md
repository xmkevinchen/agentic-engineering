---
id: roadmap-read-only-no-writes
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Principles section states "Read-only" — reads pipeline metadata, produces text output, no file writes, no state changes
- [text:contains] Principles section states "Lightweight" — no agent teams, no cross-family proxies

### MUST_NOT
- [text:contains] No TeamCreate call anywhere in the skill
- [text:contains] No Write tool call anywhere in the skill
- [text:contains] No Agent tool call anywhere in the skill
- [text:contains] No file creation or modification instructions in the skill

### SHOULD
- [text:contains] Skill reads frontmatter only, does NOT read file content
