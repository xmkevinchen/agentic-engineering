---
id: roadmap-size-cache-cleanup-on-sized
target: ae:roadmap
layer: 1
source: generated
---

## Context
- Project has 1 active feature F-100 with `size: S` set in `index.md` frontmatter (manually set, OR accepted via /ae:roadmap --resize previously)
- `.ae/cache/auto-size.yml` has a stale entry for F-100 (e.g., `auto_size_value: M` from before size: was set, OR a `--resize` was interrupted leaving cache and frontmatter both populated)
- Default `/ae:roadmap` invocation (no flags)

## Prompt
Read the ae:roadmap SKILL.md section (c) "Evaluation order" guard. When a feature has `size:` set in frontmatter AND a stale cache entry exists, what happens in the output and to the cache file?

## Prompt Variants
- Sized feature with stale cache — does roadmap show it as auto-sized?
- Does the eval-order guard clean up stale cache entries?
