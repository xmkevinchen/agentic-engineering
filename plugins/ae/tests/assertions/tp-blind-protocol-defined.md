---
id: tp-blind-protocol-defined
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md defines separate directories: prompts/ (Session TL) and assertions/ (test-lead/judge)
- [file:contains] SKILL.md specifies Session TL reads ONLY plugins/ae/tests/prompts/ during execution
- [file:contains] SKILL.md specifies Session TL does NOT read plugins/ae/tests/assertions/
- [file:contains] SKILL.md specifies --verbose flag overrides blind separation for debug purposes
- [file:contains] SKILL.md specifies blind protocol does not apply to Layer 1 (static analysis reads both)

### MUST_NOT
- [file:contains] SKILL.md merges prompt and assertion content into a single file
