---
id: agent-selection-tl-fallback-both-failed
target: ae:agent-selection
layer: 1
source: generated
---

## Expected Behavior

### MUST
- When both families have failed (condition 2), MUST "Mark cross_family_degraded" — per TL fallback logic condition 2
- When both families have failed, MUST "Continue synthesis without cross-family input"

### MUST_NOT
- MUST NOT attempt to spawn any additional proxy when both families have failed
- MUST NOT retry either family after both have been marked as failed
- MUST NOT block or halt execution when both families fail — must continue in degraded mode
