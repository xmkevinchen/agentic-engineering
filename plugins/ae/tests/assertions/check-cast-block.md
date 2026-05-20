---
test_id: check-cast-block
layer: 1
---

# Expected Behavior — check-cast-block.sh

## Pass criteria

All must hold:

1. **bash -n exit 0** — script has valid POSIX shell syntax
2. **Script exit 0** on current repo state (all 49+ Agent() spawn calls in SKILL.md inventory have full Cast block)
3. **Last line output** matches pattern: `[check-cast-block] scanned=<N> SKILL.md files, agent_calls=<M> failures=0`
4. **Counts**: `scanned >= 20` (SKILL.md count), `agent_calls >= 40` (spawn calls), `failures == 0`

## Fail signals

- Script syntax error (bash -n exit 1)
- `failures > 0` (new spawn added without Cast block, or existing spawn broken)
- Script exit 1 (false positive in script logic — unlikely; verified at ship time on 49 spawn calls)
