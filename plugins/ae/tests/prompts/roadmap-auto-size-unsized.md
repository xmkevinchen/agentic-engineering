---
id: roadmap-auto-size-unsized
target: ae:roadmap
layer: 1
source: generated
---

## Context
- Project has 1 active feature `F-100-test-feature/` with `analysis.md` body present
- Feature `index.md` frontmatter has NO `size:` field (or `size:` is empty)
- `.ae/cache/auto-size.yml` does not exist (fresh state, no prior cache)
- Default `/ae:roadmap` invocation (no flags)

## Prompt
Read the ae:roadmap SKILL.md section (c) "Sizing aggregate" and describe what the output looks like for the unsized feature F-100. Specifically: does it appear in an "Auto-sized this run:" section? What annotation tag does it carry?

## Prompt Variants
- For an unsized feature, what does roadmap output show?
- Does default invocation auto-evaluate unsized features?
