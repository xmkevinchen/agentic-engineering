---
id: consensus-verdict-dejargon
target: ae:consensus
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] The Phase 2 verdict template contains `## Recommendation` as its opening heading
- [text:contains] The template's first line anchor: `**Recommend**: [Proceed/Reject/Modify` (prefix — vocabulary may extend after Modify)
- [text:contains] The template carries a `**Verdict**:` line with the `Confirmed / Overturned / Deadlocked` vocabulary (debate-outcome contract preserved)
- [text:contains] A filled worked example follows the template (an actual `**Recommend**:` line with a concrete decision, not placeholders)
- [text:contains] The file head carries the pointer block `ae-output-standards-pointer-v1`
- [text:contains] Phase 1 internal flow still contains `ROUND_DECISION: CROSS_EXAMINE / SYNTHESIZE` (over-delete guard — internal routing untouched)
- [text:contains] The persist spec requires the `## Agent Selection Trace` appendix

### MUST_NOT
- [structure] Within the verdict template region (from the Phase 2 ```markdown fence through its closing fence): no `ROUND_DECISION`, no `### Mediator Evaluation`, no `Mode: [adaptive`, no `### Cross-examination Summary`, no `### Consensus Assessment`
- [text:not_contains] The persist spec does NOT list `Mode used (adaptive/quick/full)` or `Mediator evaluation block(s)` as verdict file contents

### SHOULD
- [text:contains] A note near the Phase 1 evaluation block states ROUND_DECISION is TL-internal and must not appear in the user-facing verdict
