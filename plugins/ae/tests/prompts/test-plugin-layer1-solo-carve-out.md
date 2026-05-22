---
id: test-plugin-layer1-solo-carve-out
target: ae:test-plugin
layer: 1
source: regression
---

## Context

User has `~/.claude/settings.json` with NO `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set (Agent Teams disabled). User runs `/ae:test-plugin --regression --layer1 <target>`. F-027 Step 3 introduced a solo carve-out for this exact flag combination — the Pre-check 1 Agent Teams gate is bypassed because `--regression --layer1` is pure static analysis (no Phase 1 generation, no Layer 2 execution, no team spawn).

## Prompt

Read the ae:test-plugin SKILL.md and describe how Pre-check 1 behaves when both `--regression` and `--layer1` flags are passed under solo conditions (env var unset). Confirm Layer 2 still refuses.

## Prompt Variants

- What does `/ae:test-plugin --regression --layer1` do when Agent Teams is disabled?
- How does the test-plugin solo carve-out interact with Layer 2 (blind protocol)?
