---
id: analyze-sees-paused
target: ae:analyze
layer: 1
source: regression
---

## Context
F-032 added the `.ae/features/paused/` state dir. `ae:analyze` must see paused features in its F-NNN allocator (avoid duplicate IDs) and double-promote check (avoid splitting the audit trail), and ensure paused/ exists.

## Prompt
Read `plugins/ae/skills/analyze/SKILL.md`. Confirm whether the pre-check, the F-NNN allocator, and the already-promoted (double-promote) check account for the `paused/` state dir, and whether there is a soft-refuse path for a BL already promoted to a paused feature.
