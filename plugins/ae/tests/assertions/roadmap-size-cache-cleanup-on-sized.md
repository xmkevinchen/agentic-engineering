---
id: roadmap-size-cache-cleanup-on-sized
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] roadmap/SKILL.md section (c) "Evaluation order" guard fires FIRST: check `index.md` `size:` before any cache logic
- [text:contains] When `size:` is non-empty, feature is skipped from auto-eval entirely
- [text:contains] When `size:` is non-empty AND a cache entry exists, the cache entry is DELETED (cleanup of stale state)
- [text:contains] Sized feature contributes to the sized count + total effort range, NOT to "Auto-sized this run:" section

### MUST_NOT
- [text:contains] Sized feature does NOT appear in "Auto-sized this run:" section regardless of cache state
- [text:contains] Stale cache entry does NOT cause `[cached]` annotation to display for a sized feature
- [text:contains] After this `/ae:roadmap` run, `.ae/cache/auto-size.yml` does NOT contain the stale F-100 entry

### SHOULD
- [text:contains] Eval-order guard documented as closing silent-failure mode where stale cache could display incorrect data for manually-sized or interrupted-resize features
