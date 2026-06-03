---
id: roadmap-close-batch-action
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] the batch-approval block fires on "≥ 1 PROMOTE OR ≥ 1 Tier-1 CLOSE" — including the zero-PROMOTE-with-Tier-1-CLOSE case
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] CLOSE confirmation is a separate `AskUserQuestion`, rendered after the PROMOTE Step A/B flow, independently selectable from PROMOTE approval
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] only Tier-1 CLOSEs are actionable via `Apply CLOSEs`; Tier-2 advisory CLOSEs are surface-only informational lines with no batch action
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Apply CLOSEs appends an undo-log line to `.ae/backlog/.close-undo-log.md` before the `mv`, then moves to `.ae/backlog/closed/` and writes closure metadata (`status: closed`, `closed:`, `closed_reason:`, optional `superseded_by:`)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Cancel labels are disambiguated: `Cancel (nothing will be promoted)` for PROMOTE, `Cancel (nothing will be closed)` for CLOSE

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] MUST NOT auto-run the CLOSE move without explicit `Apply CLOSEs` human selection
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] MUST NOT place a Tier-2 advisory-grep CLOSE in the actionable Apply CLOSEs set
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] MUST NOT bundle CLOSE confirmation into the PROMOTE approval prompt
