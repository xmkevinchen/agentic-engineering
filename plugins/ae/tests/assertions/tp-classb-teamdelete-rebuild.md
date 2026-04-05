---
id: tp-classb-teamdelete-rebuild
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] TeamDelete is called on the Phase 1 test team before the target skill executes
- [behavior] A new TeamCreate is issued after TeamDelete to rebuild the team for Phase 2
- [behavior] The rebuilt team includes both the target skill's required agents AND a resurrected test-lead

### MUST_NOT
- [behavior] The Phase 1 test team is NOT alive while the target skill (Class B) executes — only one team can occupy the slot
- [behavior] No test execution proceeds without first releasing the Phase 1 team slot

### SHOULD
- [behavior] Resurrected test-lead is initialized with context from assertion files (reads from main repo path)
