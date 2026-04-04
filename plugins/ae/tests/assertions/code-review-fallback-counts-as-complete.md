---
id: code-review-fallback-counts-as-complete
target: ae:code-review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- When a proxy fails and fallback to the other family succeeds, the degraded signal MUST be `cross_family_complete` — per exact wording: "Some proxy failed but fallback succeeded → `cross_family_complete` (fallback counts)"
- The parenthetical "(fallback counts)" in SKILL.md confirms fallback success = complete, not degraded

### MUST_NOT
- MUST NOT report `cross_family_degraded` when one family failed but the other succeeded via fallback
