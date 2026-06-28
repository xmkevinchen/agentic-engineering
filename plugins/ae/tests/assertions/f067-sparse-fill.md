---
id: f067-sparse-fill
target: ae:review
layer: 1
source: F-067
---

## Expected Behavior

### MUST
- The selection rule MUST yield `soft_added_lenses = ∅` (empty) for this diff: there is NO positive evidence for security or performance, so the additive soft-add adds nothing. This is the F-067 G1 win — the noise (forced security/perf on a game feature) is gone.
- `final_lenses` MUST still contain the floor: `challenger` + `code-reviewer` (`baseline_lenses` — the floor always runs even when no specialist is added).
- `risk_floor_lenses` MUST be empty for this diff (no path matches `work.security_patterns`), so the floor adds no forced `security`.
- The rule MUST justify omission as the **absence of a positive trigger**, NOT as pruning/dropping a lens from a full set (additive framing).

### MUST_NOT
- MUST NOT add `security` to `soft_added_lenses` (no auth/secret/migration/boundary evidence, no risk-floor match).
- MUST NOT add `performance` to `soft_added_lenses` (no hot-path/algorithmic/query evidence).
- MUST NOT drop or reduce `baseline_lenses` — a zero-specialist diff still runs the full floor (never-drop, AC2).
