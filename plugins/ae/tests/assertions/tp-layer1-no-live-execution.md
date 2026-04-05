---
id: tp-layer1-no-live-execution
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md specifies Layer 1 does NOT execute the target skill
- [file:contains] SKILL.md specifies Layer 1 verifies behavior via static analysis of SKILL.md content
- [file:contains] SKILL.md states blind protocol does NOT apply to Layer 1 (TL reads both prompts and assertions)
- [file:contains] SKILL.md states Layer 1 failures are definitive (no LLM judgment needed)

### MUST_NOT
- [file:contains] SKILL.md spawns agents or worktrees for Layer 1 execution
