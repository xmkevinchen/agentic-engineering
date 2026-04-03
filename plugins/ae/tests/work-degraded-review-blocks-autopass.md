---
id: work-degraded-review-blocks-autopass
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Auto-pass gate evaluates after every step

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- Auto-pass gate formula includes `NOT cross_family_degraded` (or equivalent negation of degraded state)
- Gate pauses for user confirmation when review is degraded
- Degraded message offers options to accept or retry

### MUST_NOT
- Auto-pass gate allows auto-continue when cross_family_degraded is true
