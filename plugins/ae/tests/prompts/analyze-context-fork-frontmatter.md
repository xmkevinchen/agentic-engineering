---
id: analyze-context-fork-frontmatter
target: ae:analyze
layer: 1
source: generated
---

## Context
- Static inspection of `plugins/ae/skills/analyze/SKILL.md`
- No runtime execution needed — this is a structural check on the skill definition file itself

## Prompt
Read the YAML frontmatter of the ae:analyze SKILL.md and verify that `context: fork` is present as a frontmatter key-value pair.

## Prompt Variants
- Check whether ae:analyze skill definition has `context: fork` in its YAML frontmatter (between the `---` delimiters at the top of SKILL.md)
- Inspect the frontmatter block of `plugins/ae/skills/analyze/SKILL.md` and confirm `context: fork` appears there, not just in the body text
