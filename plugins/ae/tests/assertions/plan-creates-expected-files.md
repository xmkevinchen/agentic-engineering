---
id: plan-creates-expected-files
target: ae:plan
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [file:exists] A plan file is created — either at `<feature-dir>/plan.md` (Plan 051+ when feature is resolvable) OR at `output.plans/NNN-slug.md` (legacy fallback for free-text or unpromoted-BL invocations).
- [file:contains] Plan file contains `## Steps` section
- [file:contains] Plan file contains `## Acceptance Criteria` section
- [file:contains] Plan file frontmatter contains `status: draft` or `status: reviewed`

### MUST_NOT
- [file:contains] No step without `Expected files:` line (per REQUIRED template rule)

### SHOULD
- [behavior] Each AC is specific and verifiable (not vague like "results should be reasonable")
- [behavior] Each step references AC numbers
- [behavior] `Expected files:` lists contain real file paths (not just placeholders)
