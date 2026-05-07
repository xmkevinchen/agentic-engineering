---
id: roadmap-size-cache
target: ae:roadmap
layer: 1
source: generated
---

## Context
- Project has 1 active unsized feature F-100 with analysis.md
- `.ae/cache/auto-size.yml` already populated with entry for F-100: `auto_size_value: M`, `basis_sha: <hex>`, `computed_at: <date>`
- Neither `analysis.md` nor `index.md` body has changed since cache was written
- Second invocation of `/ae:roadmap` (no flags)

## Prompt
Read the ae:roadmap SKILL.md section (c) cache-handling logic. What does the output show for F-100 on the second invocation? Specifically: does it carry `[cached]` or `[evaluated]` annotation? Is the LLM re-invoked?

## Prompt Variants
- Repeat /ae:roadmap with unchanged inputs — what's different from first run?
- Does roadmap re-evaluate or reuse cache when basis_sha matches?
