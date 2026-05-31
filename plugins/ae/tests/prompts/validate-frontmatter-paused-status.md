---
id: validate-frontmatter-paused-status
target: validate-feature-frontmatter
layer: 1
source: regression
---

## Context
F-032 added `paused` as a 4th feature status with its own `.ae/features/paused/` dir. The frontmatter validator must scan paused/, accept `status: paused`, and validate paused features strictly (never grandfathered — paused is non-terminal and resumes).

## Prompt
Read `plugins/ae/scripts/validate-feature-frontmatter.sh`. Confirm how it handles the `paused` state dir and status value, and whether `paused` features are subject to the grandfather (lenient-validation) path.
