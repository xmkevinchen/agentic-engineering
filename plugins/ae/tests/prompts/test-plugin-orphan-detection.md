---
id: test-plugin-orphan-detection
target: ae:test-plugin
layer: 1
source: manual
---

## Context

Phase 3 of ae:test-plugin's Report step includes a pre-report orphan-file detection: scan `plugins/ae/tests/prompts/` and `plugins/ae/tests/assertions/` for unmatched files (base-name mismatch between the two directories). Fixture scenario: `prompts/foo.md` exists but `assertions/foo.md` does not (and vice versa). The test-plugin Phase 3 report must surface these as advisory warnings under an `## Orphan test files` subsection.

## Prompt

Verify ae:test-plugin SKILL.md Phase 3 specifies orphan-file detection with correct semantics: compare base names across prompts/ and assertions/, emit advisory warnings for unmatched files, do NOT fail the suite on orphans.
