---
test_id: check-shutdown-canonical
layer: 1
plan: ".ae/plans/055-t2-schema-discipline-triplet.md"
step: 1
---

# Test: check-shutdown-canonical.sh CI grep (Layer 1)

## Context

Plan 055 Step 1 ships SendMessage shutdown handshake canonical centralization. This Layer 1 fixture verifies:
- canonical doc exists in ae:agent-teams SKILL.md
- 15 non-exempt agents reference canonical
- 2 exempt agents (test-lead + minimal-change-engineer) skip
- script syntax valid (bash -n)
- exit 0 on current repo (positive case)

## Prompt

```bash
# Syntax check
bash -n plugins/ae/scripts/check-shutdown-canonical.sh

# Positive case: should exit 0 on clean repo state
bash plugins/ae/scripts/check-shutdown-canonical.sh

# Inspect output format
bash plugins/ae/scripts/check-shutdown-canonical.sh 2>&1 | tail -1
```
