---
id: retrospect-skips-test-report-type
target: ae:retrospect
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with `output.reviews` configured
- Reviews directory contains files with `type: test-report` in frontmatter AND files with `type: review` in frontmatter
- Only the `type: review` files have Outcome Statistics

## Prompt
Read the ae:retrospect SKILL.md and describe which review file types are processed vs skipped.

## Prompt Variants
- How does ae:retrospect distinguish which files to read for Outcome Statistics?
