---
id: tp-classb-teamdelete-rebuild
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] The Phase 1 teammates are shut down (shutdown_request → shutdown_response) before the target skill executes
- [behavior] New teammates are spawned via the Agent tool (name param) after the Phase 1 shutdown to rebuild for Phase 2 — no TeamCreate
- [behavior] The re-spawned teammates include both the target skill's required agents AND a resurrected test-lead

### MUST_NOT
- [behavior] The Phase 1 teammates are NOT alive while the target skill (Class B) executes — shutdown_request must be acknowledged (shutdown_response) before Phase 2 spawns; a non-responding Phase 1 teammate blocks Phase 2 start (no override path)
- [behavior] No test execution proceeds without first shutting down the Phase 1 teammates

### SHOULD
- [behavior] Resurrected test-lead is initialized with context from assertion files (reads from main repo path)
