---
id: output-standards-dejargon-rules
target: ae:work
layer: 1
source: regression
---

## Expected Behavior

All assertions read `plugins/ae/output-standards.md` explicitly (it is a shared standards doc, not a SKILL.md — the `target: ae:work` frontmatter routes the fixture run, the file-scoped markers below pin the actual read target, same pattern as `work-stop-on-paused-plan`).

### MUST
- [file:contains:plugins/ae/output-standards.md] `Rule A — Internal codes must be translated`
- [file:contains:plugins/ae/output-standards.md] `Rule B — Silent skips must be announced`
- [file:contains:plugins/ae/output-standards.md] `Rule C — Conclusions are judgments, not process records`
- [file:contains:plugins/ae/output-standards.md] `Rule D — Sentinel four-tier taxonomy`
- [file:contains:plugins/ae/output-standards.md] Rule C carries the negative list (`ROUND_DECISION`, `Mediator Evaluation`) AND a TRUE-SENTINEL exemption (load-bearing fields like the conclusion `## Process Metadata` header stay)
- [file:contains:plugins/ae/output-standards.md] Rule D names all four tiers: `TRUE SENTINEL`, `QUASI-SENTINEL`, `FIXTURE-LOCKED`, `PURE JARGON`, ordered most-restrictive-first, with a first-match-wins decision tree
- [file:contains:plugins/ae/output-standards.md] Rule D hybrid case: P1/P2/P3 translate the label, never change the value (example `P1 (blocker — security/data/crash)`)
- [file:contains:plugins/ae/output-standards.md] The status section references `skills/analyze/SKILL.md:269`

### MUST_NOT
- [file:not_contains:plugins/ae/output-standards.md] The stale reference `analyze/SKILL.md:236`

### SHOULD
- [file:contains:plugins/ae/output-standards.md] The five pre-existing Standards (`Standard 1` … `Standard 5`) remain intact alongside the new section
