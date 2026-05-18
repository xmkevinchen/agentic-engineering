---
id: cast-block-emit
target: ae:agent-teams
layer: 1
source: manual
---

## Expected Behavior

### MUST

- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] `### Cast Block Syntax` section exists (header level 3, sibling to `### Selection Trace Emission`)
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] canonical form `📋 Cast: <agent-name>` documented
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] 4 mandatory fields named (Agent / Role / Angle / Why)
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] `[cast]` line format in Selection Trace mechanical verification
- [file:contains:plugins/ae/skills/agent-teams/SKILL.md] position 2 ordering rule (cast block AFTER PRIMARY CONTEXT BUNDLE, BEFORE task instructions)

### MUST (per-skill cast block presence — 13 spawning skills)

- [file:contains:plugins/ae/skills/analyze/SKILL.md] `📋 Cast:` (≥ 4 occurrences expected — analyze has 4 spawn sites)
- [file:contains:plugins/ae/skills/discuss/SKILL.md] `📋 Cast:` (≥ 9 occurrences expected — Round 0 framing 5 + council placeholder + 3 Doodlestein)
- [file:contains:plugins/ae/skills/plan/SKILL.md] `📋 Cast:` (≥ 6 occurrences expected)
- [file:contains:plugins/ae/skills/work/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/review/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/plan-review/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/think/SKILL.md] `📋 Cast:` (≥ 4 occurrences expected)
- [file:contains:plugins/ae/skills/trace/SKILL.md] `📋 Cast:` (≥ 4 occurrences expected)
- [file:contains:plugins/ae/skills/testgen/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/code-review/SKILL.md] `📋 Cast:` (≥ 1 occurrence — Track 4 Doodlestein only)
- [file:contains:plugins/ae/skills/consensus/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/team/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)
- [file:contains:plugins/ae/skills/test-plugin/SKILL.md] `📋 Cast:` (≥ 3 occurrences expected)

### MUST (challenger.md migration verified)

- [file:contains:plugins/ae/agents/workflow/challenger.md] `## Mode-conditional behavior` section exists
- [file:contains:plugins/ae/agents/workflow/challenger.md] cross-reference to `analyze/SKILL.md` (analyze mode)
- [file:contains:plugins/ae/agents/workflow/challenger.md] cross-reference to `review/SKILL.md` (review mode)
- [file:contains:plugins/ae/agents/workflow/challenger.md] cross-reference to `consensus/SKILL.md` (critic mode)

### MUST_NOT (challenger.md migration: old mode sections removed)

- [text:regex:plugins/ae/agents/workflow/challenger.md] MUST_NOT contain `^## /review Mode` pattern
- [text:regex:plugins/ae/agents/workflow/challenger.md] MUST_NOT contain `^## /analyze Mode` pattern

### SHOULD (token economics within bounds — gemini F3 follow-up)

- [behavior] aggregate cast block additions across 13 SKILL.md should not exceed ~5KB per file growth — non-blocking quality signal per F-019 plan AC8a (≤100 line growth per skill)

## Judge

mechanical — all assertions are file-content greppable; no LLM judgment required.
