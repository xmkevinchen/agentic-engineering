---
id: test-plugin-hybrid-execution-defined
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- SKILL.md for ae:test-plugin is readable

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- Layer 2 section defines Class A execution (subagent, no Agent Teams)
- Layer 2 section defines Class B execution (Session TL, Agent Teams required)
- Classifier rule scans target SKILL.md for TeamCreate or Agent patterns
- Class A has fallback chain (worktree → session fallback → INFRA_FAIL)
- Unreadable/unclassifiable target results in FAIL_CLOSED

### MUST_NOT
- Layer 2 has only a single execution path (must have both Class A and Class B)
