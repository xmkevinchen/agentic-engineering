---
id: validate-frontmatter-paused-status
target: validate-feature-frontmatter
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/scripts/validate-feature-frontmatter.sh] The state-dir loop scans `paused`: `for state_dir in active done abandoned paused`.
- [file:contains:plugins/ae/scripts/validate-feature-frontmatter.sh] The status enum accepts `paused`: `active|done|abandoned|paused|""`.
- [file:contains:plugins/ae/scripts/validate-feature-frontmatter.sh] The grandfather branch EXCLUDES paused (validates strictly like active): the guard tests `[ "$state_dir" != "paused" ]` (so a `paused/` feature is never grandfathered) — F-032 D6.

### MUST_NOT
- [file:not_contains:plugins/ae/scripts/validate-feature-frontmatter.sh] The pre-F-032 3-value enum line `active|done|abandoned|"") ;;` (must be the 4-value form).
- [file:not_contains:plugins/ae/scripts/validate-feature-frontmatter.sh] A grandfather guard that excludes ONLY active (`[ "$state_dir" != "active" ] && is_grandfathered` with no paused exclusion) — paused must also be excluded.
