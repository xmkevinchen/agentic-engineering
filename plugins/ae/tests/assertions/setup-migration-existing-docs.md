---
id: setup-migration-existing-docs
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] setup/SKILL.md Step 4 specifies per-slot directory scan (not all-or-nothing)
- [text:contains] When content exists in `docs/<slot>/`, setup writes only that slot (`output.<slot>: "docs/<slot>/"`)
- [text:contains] Slots without legacy content are skipped (fall through to `.ae/<slot>/` canonical default)
- [text:contains] Generated pipeline.yml in this scenario contains `output.discussions: "docs/discussions/"` only

### MUST_NOT
- [text:contains] setup does NOT write all 6 slots when only one legacy dir exists
- [text:contains] setup does NOT write `output.plans`, `output.milestones`, `output.backlog`, `output.reviews`, `output.analyses` slots when those `docs/<X>/` dirs have no content

### SHOULD
- [text:contains] Per-slot scan checks for `.md` file presence (≥ 1 file = "has content")
