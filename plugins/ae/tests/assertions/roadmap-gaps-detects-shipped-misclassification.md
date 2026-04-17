---
id: roadmap-gaps-detects-shipped-misclassification
target: ae:roadmap
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [text:contains] Output contains `[error]` severity marker (not just `warn`)
- [text:contains] Output mentions `BL-999` (the fixture item ID) in the error line
- [text:contains] Output mentions `semantic-classification` or equivalent audit name
- [text:contains] Output mentions `closed/` (the file's current location)
- [text:contains] Output mentions `v0.7.9` or `done/v0.7.9/` (the expected correct location)
- [text:contains] Output mentions `CHANGELOG.md` as the authoritative source consulted

### MUST_NOT
- [text:contains] MUST NOT suppress the finding (no "0 errors" output)
- [behavior] MUST NOT auto-fix the misclassification (read-only invariant — user fixes manually)
- [file:exists] NO file moves or modifications after `--gaps` runs (read-only)

### SHOULD
- [text:contains] Output includes a summary line with total counts per severity
- [text:contains] Output includes the specific file path `.ae/backlog/closed/BL-999-fixture-shipped-item.md`
- [text:contains] Output guidance or suggestion that the item should move to `done/v0.7.9/`
