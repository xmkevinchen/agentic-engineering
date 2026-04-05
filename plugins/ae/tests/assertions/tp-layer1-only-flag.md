---
id: tp-layer1-only-flag
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md defines `--layer1` flag that skips all Layer 2 cases
- [file:contains] SKILL.md states --layer1 is used by C.5 pre-commit check to avoid live execution side effects
- [file:contains] SKILL.md states --layer1 is combinable with --regression or --refresh

### MUST_NOT
- [file:contains] SKILL.md allows --layer1 and --regression/--refresh to be mutually exclusive (they must be combinable)
