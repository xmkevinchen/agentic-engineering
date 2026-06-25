---
id: test-plugin-layer1-solo-carve-out
target: ae:test-plugin
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Pre-check 1 contains the carve-out clause `if both \`--regression\` and \`--layer1\` flags are present, skip the Agent Teams refuse`
- [text:contains] SKILL.md Pre-check 1 contains explicit reference to Layer 2 still requiring Agent Teams (text: `Layer 2 path still requires Agent Teams`)
- [text:contains] SKILL.md Flags section documents the solo carve-out under `--layer1` description (text: `Solo carve-out` or equivalent referencing both `--regression` and `--layer1`)
- [text:contains] SKILL.md cross-links to `docs/agent-teams-policy.md` from the carve-out description

### MUST_NOT
- [text:contains] SKILL.md MUST NOT remove the Layer 2 Agent Teams refuse path (the blind protocol requires team isolation)
- [text:contains] SKILL.md MUST NOT introduce a solo carve-out for `--refresh` or any other flag combination outside `--regression --layer1`

### SHOULD
- [text:contains] Pre-check 1 wording makes the conditional clear: env var present → normal; env var absent AND `--regression --layer1` → solo; env var absent AND any other combination → refuse
- [behavior] When the solo carve-out path is taken, no teammates are spawned via the `Agent` tool (no `name`-addressed spawn, no `team_name` arg) during the run
