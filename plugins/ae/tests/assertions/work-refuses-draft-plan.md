---
id: work-refuses-draft-plan
target: ae:work
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check 1 contains explicit `status: draft → refuse to execute` branch (or equivalent prose stating refuse on draft)
- [text:contains] SKILL.md Check 1 refusal message instructs user to run `/ae:plan-review <plan-path>` first
- [text:contains] SKILL.md Check 1 accepts `status: reviewed` and `status: done` as valid execution states

### MUST_NOT
- [text:contains] SKILL.md MUST NOT introduce an `--allow-draft` or `--unsafe-draft` or similar bypass flag that proceeds past `status: draft` refuse
- [text:contains] SKILL.md MUST NOT default-accept any unknown status value as if it were `reviewed`

### SHOULD
- [text:contains] Refusal message includes the plan path so the user can copy-paste the `/ae:plan-review` command
- [behavior] When given a `status: draft` plan, `/ae:work` exits without writing any commits or modifying the plan file
