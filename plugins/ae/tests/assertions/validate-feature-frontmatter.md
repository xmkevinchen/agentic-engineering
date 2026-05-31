---
test_id: validate-feature-frontmatter
layer: 1
---

# Expected Behavior — validate-feature-frontmatter.sh

## Pass criteria

All must hold:

1. **bash -n exit 0** — script has valid POSIX shell syntax
2. **Script exit 0** on current repo state
3. **Last line output** matches pattern: `[validate-frontmatter] features: validated=<N> grandfathered=<G> | plans: validated=<P> | warnings=<W> failures=0`
4. **Counts**: `validated >= 1` (at least 1 feature checked), `plans validated >= 1`, `failures == 0`
5. Active AND paused features always validated (never grandfathered — paused validates strictly like active per F-032 D6, since it is non-terminal and resumes)
6. `status: paused` is accepted by the enum (a `paused/` feature with `status: paused` does NOT count as a failure)

## Fail signals

- Script syntax error (bash -n exit 1)
- `failures > 0` (real schema violation or new validation drift)
- Script exit 1 (false positive — unlikely; verified at ship on 22 features + 53 plans clean)
