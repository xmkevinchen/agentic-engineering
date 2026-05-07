---
id: setup-precedence-coexist
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] setup/SKILL.md Step 4 documents precedence rule for coexisting docs/<slot>/ and .ae/<slot>/
- [text:contains] When both `docs/<slot>/` and `.ae/<slot>/` exist with content, `docs/<slot>/` wins
- [text:contains] Rationale: legacy migration signal (user is bringing legacy layout)
- [text:contains] Generated pipeline.yml writes `output.discussions: "docs/discussions/"` in coexist scenario

### MUST_NOT
- [text:contains] When only `.ae/<slot>/` exists (no `docs/<slot>/`), setup does NOT write `output.<slot>: ".ae/<slot>/"` (canonical default is implicit)
- [text:contains] setup does NOT write `.ae/<slot>/` as an explicit slot value at any time

### SHOULD
- [text:contains] Comment or rationale explains that explicit slot value is reserved for non-default paths
