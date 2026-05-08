---
id: analyze-pre-approved-values-input
target: ae:analyze
layer: 1
source: generated
---

## Context
- F-007 Step 2 added a "Pre-approved values input" subsection at top of Mode A in `/ae:analyze`
- When invoked from `/ae:roadmap`'s batch-approval orchestration loop, the spawn prompt contains a `PRE_APPROVED_VALUES` block that pre-fills Step 7 (size) and Step 8 (depends_on)
- Standalone invocation (direct user invocation without the block) MUST behave unchanged from today

## Prompt
Read the ae:analyze SKILL.md "Pre-approved values input" subsection + Step 7 + Step 8. Describe how `/ae:analyze` recognizes and consumes the `PRE_APPROVED_VALUES` block. Specifically: what's the recognition mechanism? What happens when the block is absent? What happens when only `size:` is present (and not `depends_on:`)? What does the literal value `none` mean for `depends_on:`? What's the format authority — does this skill define the format or reference it from elsewhere?

## Prompt Variants
- For a direct `/ae:analyze BL-NNN` invocation (no orchestration loop), what does Step 7 do?
- When the spawn prompt has `PRE_APPROVED_VALUES.size: M` but no depends_on, what does Step 8 do?
- When does the existing `index.md` `size:` value win over a pre-approved value?
