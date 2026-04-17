---
id: roadmap-flow-health-signals-advisory
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Board View has a Flow-health signals subsection (heading or bolded section)
- [text:contains] SKILL.md specifies WIP overload warning with per-column thresholds (In Progress > 1 OR Review > 1) plus combined backstop (> 2)
- [text:contains] SKILL.md specifies work-item age warning threshold of 7 days
- [text:contains] SKILL.md documents the WIP rationale (one primary active + one in review; per-column catches failure modes combined threshold misses)
- [text:contains] SKILL.md states both signals are advisory (warning text only)
- [text:contains] SKILL.md states both signals are baseline-free (no velocity dependency)

### MUST_NOT
- [text:contains] Flow-health signals MUST NOT block any operation (they are advisory text output)
- [text:contains] MUST NOT require velocity baseline to emit these signals
- [text:contains] MUST NOT hardcode a threshold without rationale (WIP threshold is documented; silent magic numbers are forbidden)

### SHOULD
- [text:contains] Signals skip entirely when no active sprint exists
- [text:contains] Thresholds noted as hardcoded in Phase B with configurability deferred
