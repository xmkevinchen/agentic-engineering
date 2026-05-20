---
test_id: validate-feature-frontmatter
layer: 1
plan: ".ae/plans/055-t2-schema-discipline-triplet.md"
step: 3
---

# Test: validate-feature-frontmatter.sh (Layer 1)

## Context

Plan 055 Step 3 ships folded frontmatter validator covering both feature index.md + plan frontmatter (intentional coupling per archaeologist Round 2; escape hatch documented in script header). AC4 grandfather scope: existing done/abandoned features (mtime > 30d) skip; active features always validate; recent done/abandoned validate.

## Prompt

```bash
# Syntax check
bash -n plugins/ae/scripts/validate-feature-frontmatter.sh

# Positive case: should exit 0 on current state
bash plugins/ae/scripts/validate-feature-frontmatter.sh

# Inspect counts
bash plugins/ae/scripts/validate-feature-frontmatter.sh 2>&1 | tail -1
```
