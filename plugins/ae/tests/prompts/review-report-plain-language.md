---
id: review-report-plain-language
target: ae:review
layer: 1
source: regression
---

## Context

F-037 made `plugins/ae/skills/review/SKILL.md`'s user-facing report instructions plain-language: the KL #1 substitution finding leads with a human-readable warning, severity codes carry a display gloss, and Outcome Statistics opens with a one-line verdict — while the 6 plugin-stats-parsed field labels and the [AE-REVIEW] traces stay byte-identical.

## Prompt

Static analysis of `plugins/ae/skills/review/SKILL.md`: verify the plain-language report instructions persist AND the sentinel strings are untouched.
