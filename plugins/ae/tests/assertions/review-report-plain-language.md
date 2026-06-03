---
id: review-report-plain-language
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] The KL #1 check emits plain language first: `Substitution warning: step N claimed a multi-track code review that did not actually run (internal code KL #1)`
- [text:contains] `KL #1` still present (code preserved as parenthetical audit anchor, not stripped)
- [text:contains] Severity display gloss present: `P1 (blocker — security/data/crash)` and `P2 (should fix — logic/perf/maintainability)` and `P3 (minor)`
- [text:contains] Outcome Statistics opens with the verdict line template: `Bottom line: <verdict>, N findings (X fixed, Y deferred), no blockers escaped.`
- [text:contains] TRUE SENTINEL guard — all 6 parsed field labels still present verbatim: `Rework rate`, `P1 escape rate`, `Drift events`, `Fix loop triggers`, `Auto-pass rate`, `Cross-family participation`
- [text:contains] QUASI guard — `[AE-REVIEW] Args tokenized` and `[AE-REVIEW] Argument inference` trace lines still present

### MUST_NOT
- [text:not_contains] The KL #1 emission instruction no longer reads as bare-code-only (the old `emit \`KL #1 substitution\` finding` phrasing without the plain-language lead is gone)

### SHOULD
- [text:contains] The Outcome Statistics intro notes the field labels are parsed by plugin-stats and must never be renamed
