---
id: work-drift-no-expected-files-hardstop
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Check B (Drift Check) handles the case where plan step has no "Expected files:" line
- Focus: hard stop behavior (distinct from auto-pass gate's UNKNOWN drift pause)
- Plan step does NOT contain an "Expected files:" line (but step has other content)

## Prompt
(static analysis — no execution required)
