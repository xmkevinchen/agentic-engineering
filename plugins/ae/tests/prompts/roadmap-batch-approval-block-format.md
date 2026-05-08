---
id: roadmap-batch-approval-block-format
target: ae:roadmap
layer: 1
source: generated
---

## Context
- F-007 Step 1 added a "Batch-approval block" subsection to `/ae:roadmap` section (a)
- Subsection fires after the per-BL verdict pass when at least one PROMOTE verdict was emitted
- Provenance tags `[frontmatter]` / `[inferred]` are the deterministic anti-rubber-stamp signal

## Prompt
Read the ae:roadmap SKILL.md section (a) "Batch-approval block" subsection and describe the approval block format. Specifically: what fields appear per BL? What separator lines? What conditional rendering rules (when is `Depends on:` shown vs hidden, when is `Order reason:` shown vs hidden)? Is there an escape-hatch note about what happens when the displayed order is wrong?

## Prompt Variants
- For an approval block with 4 PROMOTE candidates, describe what the user sees.
- What's the difference between `[frontmatter]` and `[inferred]` provenance tags?
- When is the batch-approval block NOT emitted?
