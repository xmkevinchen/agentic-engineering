---
id: work-check3-reads-env-not-experiments
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Check 3 reads `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` from `~/.claude/settings.json`
- [text:contains] The field path is under the `env` key (i.e. `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), not a top-level key

### MUST_NOT
- [behavior] MUST NOT read an `experiments` key or `experiments.agent_teams` path
- [behavior] MUST NOT check a top-level `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` flag outside the `env` object
- [behavior] MUST NOT reference any flag name other than `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` under `env`
