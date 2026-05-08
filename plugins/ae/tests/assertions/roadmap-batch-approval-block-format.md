---
id: roadmap-batch-approval-block-format
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] roadmap/SKILL.md section (a) describes a "Batch-approval block" subsection that runs only when at least one PROMOTE verdict was emitted
- [text:contains] Approval block has count header `PROMOTE candidates (N)` with separator lines above and below
- [text:contains] Per-BL line includes title (truncated to ~55 chars) + size with provenance tag `[frontmatter]` or `[inferred]`
- [text:contains] Conditional continuation line `Depends on: F-MMM [<provenance>]` rendered ONLY when depends_on is non-empty
- [text:contains] Conditional continuation line `Order reason: <one line>` rendered ONLY when ordering is LLM-inferred AND non-trivial
- [text:contains] Provenance tag literal is exactly `[frontmatter]` or `[inferred]` — no other variants
- [text:contains] Escape-hatch note above the BL list documents that displayed order = execution order AND that the correction path is dropping a BL and re-running with explicit `depends_on:` frontmatter

### MUST_NOT
- [text:contains] Approval block does NOT include full PROMOTE rationale, confidence scores, or LLM reasoning chains (noise per F-007/001 codex Round 1 finding)
- [text:contains] Approval block is NOT emitted when PROMOTE list is empty (existing "inbox is empty" message preserved)
- [text:contains] Inline edit operations (re-order, size override, depends_on override) are NOT supported in the approval block

### SHOULD
- [text:contains] Title column truncation uses `…` ellipsis when longer than ~55 chars
- [text:contains] Out-of-scope edit operations subsection cites F-007/001 conclusion as source
