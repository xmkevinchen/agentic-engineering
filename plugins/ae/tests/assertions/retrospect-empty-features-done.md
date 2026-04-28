---
id: retrospect-empty-features-done
target: ae:retrospect
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md State Reading stops with empty-window message when no archived features exist in the cutoff window
- [text:contains] Output contains "no archived features" or "no features archived" or equivalent prose
- [text:contains] Output mentions `/ae:plugin-stats` as the alternative for AE plugin self-development outcome stats (preserves discoverability across the retrospect/plugin-stats split)

### MUST_NOT
- [behavior] MUST NOT write a file (ae:retrospect output is conversational only — no file output)
- [behavior] MUST NOT call `memory_ingest` (capture is the user's choice, not the skill's)
- [behavior] MUST NOT synthesize a 4-section report from zero data
- [text:not_contains] Output does NOT contain "Outcome Statistics" as a required data source — that's `/ae:plugin-stats`'s contract, not retrospect's

### SHOULD
- [text:contains] Output references `.ae/features/done/` as the read source
