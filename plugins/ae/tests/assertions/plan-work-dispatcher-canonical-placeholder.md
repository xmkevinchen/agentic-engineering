---
id: plan-work-dispatcher-canonical-placeholder
target: ae:plan,ae:work
layer: 1
source: manual
---

## Expected Behavior

### MUST

- [file:contains:plugins/ae/skills/plan/SKILL.md] subagent_type: "<per agent-selection>" (plan-review architect slot uses canonical dispatcher placeholder)
- [file:contains:plugins/ae/skills/work/SKILL.md] subagent_type: "<per agent-selection>" (work execution dev-agent slot uses canonical dispatcher placeholder)
- [file:contains:plugins/ae/skills/work/SKILL.md] subagent_type: "qa" (qa preserved as structural counterpart per F-004 analysis — always paired with dev-agent)
- [file:contains:plugins/ae/skills/plan/SKILL.md] Before `TeamCreate` (BL-058 trace-emission gate text present in plan SKILL.md — F-004 plan-review Doodlestein regret hedge)
- [file:contains:plugins/ae/skills/work/SKILL.md] Before `TeamCreate` (BL-058 trace-emission gate text present in work SKILL.md — F-004 plan-review Doodlestein regret hedge)

### MUST_NOT

- [file:contains:plugins/ae/skills/plan/SKILL.md] subagent_type: "architect" (architect must NOT be hardcoded post-F-004; dispatcher resolves it)
- [file:contains:plugins/ae/skills/work/SKILL.md] subagent_type: "<dev-agent>" (non-canonical placeholder must NOT remain post-F-004; canonical form is `<per agent-selection>`)
