---
id: team-teamcreate-called
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Calls TeamCreate tool
- [text:regex] TeamCreate team_name is non-empty and task-descriptive (not a generic placeholder like "team" or "my-team")
- [behavior] Spawns at least 2 Agent instances
- [behavior] All spawned Agents have `run_in_background: true`
