---
id: plugin-stats-compare-same-id-error
target: ae:plugin-stats
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with `output.analyses` configured
- At least two retrospect reports (`type: retrospect`) exist in `output.analyses`

## Prompt
/ae:plugin-stats --compare 001 001

## Prompt Variants
- /ae:plugin-stats --compare 003 003
