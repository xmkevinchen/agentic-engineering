---
id: no-simplicity-reviewer
target: ae:consensus, ae:review, ae:analyze, ae:plan, ae:plan-review, ae:think, ae:trace, ae:testgen, ae:team
layer: 1
source: generated
---

## Context
- SKILL.md files for all 9 agent-teams skills are readable
- simplicity-reviewer agent was removed from all skill references

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- All 9 skills are executable without simplicity-reviewer

### MUST_NOT
- No "simplicity-reviewer" appears as a `subagent_type` value
- No "simplicity-reviewer" appears in Teammates sections
- No "simplicity-reviewer" referenced in prose instructions
