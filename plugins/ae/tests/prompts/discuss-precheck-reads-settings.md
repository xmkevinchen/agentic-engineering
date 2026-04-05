---
id: discuss-precheck-reads-settings
target: ae:discuss
layer: 1
source: generated
---

## Context

User has `~/.claude/settings.json` with no `env` section (or `env` section missing `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key). User runs `/ae:discuss "should agent teams be required?"`.

## Prompt

Invoke ae:discuss with a topic argument. Settings file does not have `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set.
