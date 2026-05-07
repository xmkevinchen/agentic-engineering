---
id: roadmap-size-cache
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] roadmap/SKILL.md section (c) describes cache HIT path: when `basis_sha` matches current hash, reuse stored `auto_size_value` AND `auto_size_reason` and mark `[cached]`
- [text:contains] Cache HIT case skips LLM invocation for that feature
- [text:contains] Output line for cached feature ends with `[cached]` annotation (NOT `[evaluated]`)
- [text:contains] Cache schema includes `auto_size_reason` field (required for cache HIT to compose the `<reason>` portion of the output line)
- [text:contains] basis_sha is computed as sha256(analysis.md body + index.md body) first 16 hex chars

### MUST_NOT
- [text:contains] Cache HIT does NOT re-invoke LLM
- [text:contains] Cache HIT does NOT modify `.ae/cache/auto-size.yml` entry's `auto_size_value`

### SHOULD
- [text:contains] When `analysis.md` body changes (any byte), basis_sha mismatches → cache MISS → re-evaluation → output shows `[evaluated]`
- [text:contains] Corrupted cache file is treated as empty (warn + re-evaluate everything)
