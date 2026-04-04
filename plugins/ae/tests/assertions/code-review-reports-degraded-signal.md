---
id: code-review-reports-degraded-signal
target: ae:code-review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- When ALL cross-family proxies fail after fallback (both families failed), the skill MUST report `cross_family_degraded`
- The three degraded signal states MUST be exactly: `cross_family_complete`, `cross_family_complete` (with fallback note), and `cross_family_degraded` — as defined in the "Degraded signal" section

### MUST_NOT
- MUST NOT report `cross_family_degraded` when some proxy failed but fallback succeeded — this case is `cross_family_complete` per: "Some proxy failed but fallback succeeded → `cross_family_complete` (fallback counts)"
- MUST NOT report a fourth undefined signal state (e.g., `cross_family_partial` or `cross_family_fallback`)
