---
id: retrospect-compare-insufficient-data
target: ae:retrospect
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with `output.analyses` configured
- `output.analyses` contains exactly ONE retrospect report with `type: retrospect`
- No second retrospect report exists for comparison

## Prompt
/ae:retrospect --compare 001 002

## Prompt Variants
- /ae:retrospect --compare 001 003
