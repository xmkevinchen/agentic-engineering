---
id: roadmap-auto-size-unsized
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] roadmap/SKILL.md section (c) describes "Auto-sized this run:" output section for unsized features
- [text:contains] Each auto-sized line has form `F-NNN → <T-shirt> (~<range>) — <reason>`
- [text:contains] Each auto-sized line ends with annotation `[evaluated]` (fresh LLM eval) or `[cached]` (cache hit)
- [text:contains] First-run scenario (no prior cache) yields `[evaluated]` annotation
- [text:contains] Cache file `.ae/cache/auto-size.yml` is created/updated with feature entry containing `auto_size_value`, `basis_sha`, `computed_at`

### MUST_NOT
- [text:contains] Default `/ae:roadmap` does NOT write to feature `index.md` `size:` automatically
- [text:contains] No bare `unsized: <count>` line in section (c) output (replaced by Auto-sized this run section)

### SHOULD
- [text:contains] Output includes `To persist auto-sized values to frontmatter, run /ae:roadmap --resize.` hint line
- [text:contains] Features without analysis.md get `(low-confidence — no analysis.md)` mark
