---
id: review-paused-to-done
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/review/SKILL.md] The Phase 2 archive move uses a dynamic source state — `mv .ae/features/<source-state>/F-NNN-<slug>/ .ae/features/done/...` — derived from the resolved plan path, NOT a hardcoded `active`.
- [file:contains:plugins/ae/skills/review/SKILL.md] A reviewed-and-passed paused feature archives to `done/` (paused→done, F-032 D7).
- [file:contains:plugins/ae/skills/review/SKILL.md] On `verdict: fail`, the feature stays in its CURRENT state dir (`features/active/` or `features/paused/`), not hardcoded `active/`.

### MUST_NOT
- [file:not_contains:plugins/ae/skills/review/SKILL.md] A Phase 2 archive hardcoded as `mv .ae/features/active/F-NNN-<slug>/ .ae/features/done/F-NNN-<slug>/` (must be dynamic `<source-state>`).
