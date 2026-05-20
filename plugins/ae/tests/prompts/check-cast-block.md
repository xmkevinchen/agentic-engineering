---
test_id: check-cast-block
layer: 1
plan: ".ae/plans/055-t2-schema-discipline-triplet.md"
step: 2
---

# Test: check-cast-block.sh CI grep (Layer 1)

## Context

Plan 055 Step 2 ships cast-block CI grep + closes BL-079. This Layer 1 fixture verifies script syntax + positive pass + counts.

## Prompt

```bash
# Syntax check
bash -n plugins/ae/scripts/check-cast-block.sh

# Positive case: should exit 0 on current SKILL.md inventory
bash plugins/ae/scripts/check-cast-block.sh

# Inspect counts
bash plugins/ae/scripts/check-cast-block.sh 2>&1 | tail -1
```
