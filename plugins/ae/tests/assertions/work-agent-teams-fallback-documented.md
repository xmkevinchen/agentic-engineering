---
id: work-agent-teams-fallback-documented
target: ae:work
layer: 1
source: manual
---

## Expected Behavior

### MUST (structurally-bounded — section-scope intent per Doodlestein-strategic R2)

- [text:regex:plugins/ae/skills/work/SKILL.md] `### Check 3: Agent Teams[\s\S]{0,1500}AGENT_TEAMS_FULL` — the `AGENT_TEAMS_FULL` variable name MUST appear within ~1500 chars of the `### Check 3: Agent Teams` heading (verifies the variable is documented in the Check 3 section, not relocated to a generic "Fallback behavior" appendix or deleted entirely)
- [text:regex:plugins/ae/skills/work/SKILL.md] `### Check 3: Agent Teams[\s\S]{0,1500}\[WARNING\] Agent Teams unavailable, running solo` — the verbatim user-visible WARNING message MUST appear within ~1500 chars of the Check 3 heading

### MUST (file-scoped content presence)

- [file:contains:plugins/ae/skills/work/SKILL.md] `auto-fallback` — the term "auto-fallback" appears in the spec (Check 3 path) documenting the fallback transition
- [file:contains:plugins/ae/skills/work/SKILL.md] `Lead executes` — the solo TDD execution path documents Lead-direct execution (matches the SKILL.md prose: "Lead executes TDD cycle directly")
- [file:contains:plugins/ae/skills/work/SKILL.md] `tests_green` — outcome-statistics degradation surface documented (auto-pass gate UNVERIFIED state surfaces in Outcome Statistics)

### MUST_NOT

- [behavior] MUST NOT silently delete the WARNING emission when refactoring Check 3 — the verbatim string `[WARNING] Agent Teams unavailable, running solo` is the user's only signal that AE has degraded; deletion is a P1 regression

### Notes

- This fixture's value is regression-proofing across refactors, not catching defects in the current SKILL.md (which is already shipped and operationally verified).
- Two MUST assertions use `[text:regex:<path>]` with `[\s\S]{0,1500}` non-greedy span to bound proximity to the `### Check 3` heading. This is the closest mechanical approximation to "section-scoped" available in the current fixture framework. When the framework gains true section-scoped assertions (future BL), upgrade.
- Layer 2 dynamic exercise of the fallback path is the complementary verification half; deferred to BL-076 with forcing-function reopen trigger.

## Judge

mechanical — all MUST assertions are file-content greppable / regex-checkable; the MUST_NOT [behavior] is a soft contract documented in prose (no current automated check, future improvement).
