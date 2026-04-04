---
id: work-missing-ac-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- When the plan file does not contain `## Acceptance Criteria` or `## AC`, the skill MUST output a suggestion to run `/ae:plan`
- When AC is missing, the skill MUST refuse to execute (exact wording from SKILL.md Check 1: "If missing → suggest `/ae:plan`, **refuse to execute**")
- The refusal MUST occur during Pre-checks (Check 1: Plan Exists & Reviewed), before any other checks or execution

### MUST_NOT
- MUST NOT proceed to Check 2 (Locate Current Step) when AC is missing
- MUST NOT attempt TDD cycle, Agent Teams creation, or any execution flow when AC is missing
- MUST NOT treat a plan without AC as valid regardless of its `status` frontmatter value
