---
id: output-standards-dejargon-rules
target: ae:work
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] `plugins/ae/output-standards.md` contains `Rule A — Internal codes must be translated`
- [text:contains] Contains `Rule B — Silent skips must be announced`
- [text:contains] Contains `Rule C — Conclusions are judgments, not process records`
- [text:contains] Contains `Rule D — Sentinel four-tier taxonomy`
- [text:contains] Rule C carries the negative list (`ROUND_DECISION`, `Mediator Evaluation`) AND a TRUE-SENTINEL exemption (load-bearing fields like the conclusion `## Process Metadata` header stay)
- [text:contains] Rule D names all four tiers: `TRUE SENTINEL`, `QUASI-SENTINEL`, `FIXTURE-LOCKED`, `PURE JARGON`, ordered most-restrictive-first, with a first-match-wins decision tree
- [text:contains] Rule D hybrid case: P1/P2/P3 translate the label, never change the value (example `P1 (blocker — security/data/crash)`)
- [text:contains] The status section references `skills/analyze/SKILL.md:269`

### MUST_NOT
- [text:not_contains] The file does NOT contain the stale reference `analyze/SKILL.md:236`

### SHOULD
- [text:contains] The five pre-existing Standards (`Standard 1` … `Standard 5`) remain intact alongside the new section
