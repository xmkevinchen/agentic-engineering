---
id: team-teamcreate-called
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Spawns teammates via the Agent tool (no TeamCreate)
- [text:regex] Each spawned Agent has a non-empty, task-descriptive name (not a generic placeholder like "agent" or "my-agent")
- [behavior] Spawns at least 2 Agent instances
- [behavior] All spawned Agents have `run_in_background: true`
