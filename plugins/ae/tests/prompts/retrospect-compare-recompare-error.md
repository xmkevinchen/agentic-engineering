---
id: retrospect-compare-recompare-error
target: ae:retrospect
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with `output.analyses` configured
- `output.analyses` contains a file with `type: retrospect-comparison` (e.g., `001-comparison-001-vs-002.md`) with id `005`
- `output.analyses` also contains regular `type: retrospect` reports

## Prompt
/ae:retrospect --compare 005 002

## Prompt Variants
- /ae:retrospect --compare 001 005
