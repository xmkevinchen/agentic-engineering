---
test_id: check-shutdown-canonical
layer: 1
---

# Expected Behavior — check-shutdown-canonical.sh

## Pass criteria

All must hold:

1. **bash -n exit 0** — script has valid POSIX shell syntax
2. **Script exit 0** on current repo state (clean — all 15 agents reference canonical, 2 exempt)
3. **Last line output** matches pattern: `[check-shutdown] scanned=<N> referenced=<R> exempt=<E> failures=0`
4. **Counts**: `scanned >= 17` (15 with-shutdown + 2 exempt; total may include other agent files), `referenced == 15`, `exempt == 2`, `failures == 0`
5. **Canonical doc present**: `grep -c "^## Shutdown handshake (canonical)$" plugins/ae/skills/agent-teams/SKILL.md` returns `1`

## Fail signals

- Script syntax error (bash -n exit 1)
- Script exit 1 on clean repo (false positive in script logic)
- Output format different from expected (refactor broke output contract)
- `referenced != 15` (means batch agent edit drifted or new agent added without reference)
- `failures > 0` (means inline shutdown_response detected — drift introduced)
