---
id: analyze-pre-approved-values-input
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] analyze/SKILL.md describes a "Pre-approved values input" subsection at top of Mode A (immediately after or before the Pre-check section)
- [text:contains] Recognition mechanism = grep for literal opening sentinel `---PRE_APPROVED_VALUES---` in spawn prompt
- [text:contains] Format authority points at roadmap/SKILL.md as canonical source — analyze/SKILL.md does NOT redefine the format
- [text:contains] Step 7 (size advisory) has a "Pre-approved-values guard" bullet at top: when `PRE_APPROVED_VALUES.size` is present, skip the `AskUserQuestion` and write the value directly
- [text:contains] Step 8 (depends_on advisory) has the same guard bullet
- [text:contains] Step 7 / Step 8 guards each emit a log line `[ANALYZE] Using pre-approved <field>: <value> (from /ae:roadmap batch).`
- [text:contains] Standalone invocation invariant: when `PRE_APPROVED_VALUES` block is ABSENT from spawn prompt, Step 7 + Step 8 retain their full interactive `AskUserQuestion` flow unchanged
- [text:contains] Reconciliation rule unchanged: existing `index.md` `size:` / `depends_on:` value wins over pre-approved input
- [text:contains] depends_on literal value `none` means "explicitly no dependencies" — skip frontmatter write entirely (do NOT insert empty)

### MUST_NOT
- [text:contains] analyze/SKILL.md does NOT redefine the `PRE_APPROVED_VALUES` block format (single source of truth = roadmap/SKILL.md)
- [text:contains] Pre-approved values do NOT override existing index.md frontmatter values

### SHOULD
- [text:contains] Partial fields are valid (size only, depends_on only, both) — missing field falls through to interactive prompt
- [text:contains] Malformed-block fallback: missing closing sentinel `---END_PRE_APPROVED_VALUES---` causes fall-through to interactive prompts (no silent failure)
- [text:contains] Malformed-block fallback: invalid `size:` value (not in `{XS, S, M, L, XL}`) falls through to interactive Step 7 prompt
- [text:contains] Malformed-block fallback: invalid `depends_on:` value (non-`F-NNN` tokens or malformed list syntax) falls through to interactive Step 8 prompt
- [text:contains] Empty `depends_on:` value (line present with empty value) is treated as literal `none` for forward-compatibility
- [text:contains] Recognition treats sentinel as live ONLY when free-standing line (not inside fenced code block or quoted prose)
