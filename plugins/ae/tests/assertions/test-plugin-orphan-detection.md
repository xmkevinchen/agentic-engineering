---
id: test-plugin-orphan-detection
target: ae:test-plugin
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Phase 3 has a pre-report orphan detection step OR `Orphan test files` subsection spec
- [text:contains] SKILL.md specifies comparing base names between `prompts/` and `assertions/` directories
- [text:contains] SKILL.md describes both failure modes: prompt-without-assertion AND assertion-without-prompt
- [text:contains] SKILL.md states orphan detection is advisory (does NOT fail the suite)
- [text:contains] SKILL.md Report template includes an `## Orphan test files` subsection (shown when orphans exist)

### MUST_NOT
- [behavior] Orphan detection MUST NOT cause the suite to fail or refuse
- [text:contains] MUST NOT require the user to resolve orphans before the report is written (advisory only)

### SHOULD
- [text:contains] SKILL.md provides implementation guidance (set-diff between prompts/ and assertions/ base names)
- [text:contains] SKILL.md includes rationale for advisory (not blocking) behavior
