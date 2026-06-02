---
id: work-lint-typecheck-checks
target: ae:work
layer: 1
source: manual
---

## Context

- `ae:work` SKILL.md defines a pre-commit chain: Check C (tests) → C.1 (lint) → C.2 (typecheck) → C.5 (protocol invariant) → D (code review) → E (disposition).
- F-034 added Check C.1 (consumes `lint.command`) and C.2 (consumes `typecheck.command`) with brownfield-safe, non-gating semantics.
- The auto-pass gate expression is `gate = tests_green AND no_p1 AND no_accumulated_p1 AND deferred_resolved AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)`.

## Prompt

How do Check C.1 (lint) and C.2 (typecheck) behave in `/ae:work`'s pre-commit chain when the configured command is empty versus when it exits non-zero, and how does a non-zero exit interact with the auto-pass gate?
