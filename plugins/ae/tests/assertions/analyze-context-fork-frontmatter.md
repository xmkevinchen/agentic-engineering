---
id: analyze-context-fork-frontmatter
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md YAML frontmatter block (between the first `---` lines) contains `context: fork`

### MUST_NOT
- [file:contains] Frontmatter MUST NOT have `context` set to any value other than `fork`
