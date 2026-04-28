---
id: retrospect-empty-features-done
target: ae:retrospect
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists
- `.ae/features/done/` exists but is empty (no features have been archived yet)
- `.ae/features/active/` may have in-flight features (irrelevant — retrospect reads done/)

## Prompt
/ae:retrospect

## Prompt Variants
- /ae:retrospect --since 4w
