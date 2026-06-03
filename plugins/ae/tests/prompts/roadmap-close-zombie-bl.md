---
id: roadmap-close-zombie-bl
target: ae:roadmap
layer: 1
source: manual
---

## Context

- A "zombie partial-promotion" is a BL still sitting in `.ae/backlog/unscheduled/` whose ID already appears in a feature's `origin_bl`. Before F-035 these were silently excluded from section (a).
- F-035 splits the Filtering Constraints origin_bl rule by the matched feature's state.

## Prompt

How does section (a) treat a BL in `unscheduled/` whose ID is in a feature's `origin_bl`, depending on whether that feature is active vs done/abandoned?
