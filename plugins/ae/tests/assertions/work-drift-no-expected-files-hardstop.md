---
id: work-drift-no-expected-files-hardstop
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check B states: `No "Expected files:" in plan → drift = UNKNOWN → **hard stop**`
- [text:contains] Hard stop message matches: `🛑 No Expected files in plan step — drift = UNKNOWN. Hard stop.`
- [text:contains] SKILL.md defines 3 options: (1) Add Expected files to the plan step then re-run Check B, (2) Confirm to continue (drift recorded as 'unknown' in Outcome Statistics), (3) Rollback this step's changes
- [text:contains] Hard stop message includes `Auto-pass blocked.`

### MUST_NOT
- [behavior] MUST NOT treat missing "Expected files:" as a soft warning (⚠️) — it MUST be a hard stop (🛑)
- [behavior] MUST NOT auto-continue past Check B when "Expected files:" is absent
