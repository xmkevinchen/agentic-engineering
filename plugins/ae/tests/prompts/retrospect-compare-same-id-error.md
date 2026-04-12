---
id: retrospect-compare-same-id-error
target: ae:retrospect
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with `output.analyses` configured
- At least two retrospect reports (`type: retrospect`) exist in `output.analyses`

## Prompt
/ae:retrospect --compare 001 001

## Prompt Variants
- /ae:retrospect --compare 003 003
