---
id: roadmap-flow-health-signals-advisory
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Board View has a Flow-health signals subsection (heading or bolded section)
- [text:contains] SKILL.md specifies WIP overload warning with threshold 2
- [text:contains] SKILL.md clarifies WIP counts "In Progress" AND "Review" columns combined
- [text:contains] SKILL.md specifies work-item age warning threshold of 7 days
- [text:contains] SKILL.md documents the WIP=2 rationale (allows one primary in-flight + one in-review; 3+ is breakdown; Review counts because solo-dev review consumes attention)
- [text:contains] SKILL.md states both signals are advisory (warning text only)
- [text:contains] SKILL.md states both signals are baseline-free (no velocity dependency)

### MUST_NOT
- [text:contains] Flow-health signals MUST NOT block any operation (they are advisory text output)
- [text:contains] MUST NOT require velocity baseline to emit these signals
- [text:contains] MUST NOT hardcode a threshold without rationale (WIP threshold is documented; silent magic numbers are forbidden)

### SHOULD
- [text:contains] Signals skip entirely when no active sprint exists
- [text:contains] Thresholds noted as hardcoded in Phase B with configurability deferred
