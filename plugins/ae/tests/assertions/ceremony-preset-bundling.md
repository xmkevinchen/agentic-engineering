---
id: ceremony-preset-bundling
target: ae:work, ae:plan
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### pipeline.template.yml ceremony field + canonical bundling + precedence

- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `ceremony: full` (top-level field with default value)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `full` (one of the 3 valid values listed)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `light` (one of the 3 valid values listed)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `minimal` (one of the 3 valid values listed)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `work.agent_teams` (in the 5-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `work.review_mode` (in the 5-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `work.accumulated_doodlestein` (in the 5-stage list AND as a separate field)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `plan.plan_review` (in the 5-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `plan.doodlestein` (in the 5-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `discuss.framing_review` (in the 3-deferred-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `discuss.doodlestein` (in the 3-deferred-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] `review.cross_family` (in the 3-deferred-stage list)
- [text:contains_in_file path=plugins/ae/templates/pipeline.template.yml] precedence rule cross-reference between `ceremony:` field comment and `work.review_mode:` field comment (architect plan-review #5 P1)

#### work/SKILL.md 3 ceremony read sites

- [text:contains_in_file path=plugins/ae/skills/work/SKILL.md] ceremony preset read site at Check 3 area mentioning `pipeline.yml → ceremony` AND `default: full`
- [text:contains_in_file path=plugins/ae/skills/work/SKILL.md] ceremony preset read site at Check D area mentioning `pipeline.yml → ceremony` AND `default: full`
- [text:contains_in_file path=plugins/ae/skills/work/SKILL.md] ceremony preset read site at Post-commit Doodlestein area mentioning `pipeline.yml → ceremony` AND `default: full`
- [text:contains_in_file path=plugins/ae/skills/work/SKILL.md] explicit-wins clause appears at all 3 sites (e.g., "wins on conflict" or "wins over preset" or "Explicit ... wins")

#### plan/SKILL.md 2 ceremony read sites

- [text:contains_in_file path=plugins/ae/skills/plan/SKILL.md] ceremony preset read site at Step 3 area mentioning `pipeline.yml → ceremony` AND `default: full` AND `--skip-review`
- [text:contains_in_file path=plugins/ae/skills/plan/SKILL.md] ceremony preset read site at Step 4 Doodlestein area mentioning `pipeline.yml → ceremony` AND `default: full`
- [text:contains_in_file path=plugins/ae/skills/plan/SKILL.md] explicit-wins clause appears at both sites

### MUST_NOT

- [text:not_contains_in_file path=plugins/ae/skills/discuss/SKILL.md] `pipeline.yml → ceremony` (3 deferred stages discuss.framing_review / discuss.doodlestein are out of F-013 scope; NO ceremony read site should be wired in this file)
- [text:not_contains_in_file path=plugins/ae/skills/review/SKILL.md] `pipeline.yml → ceremony` (review.cross_family is deferred to Phase 2 BL; NO ceremony read site should be wired in this file)
- [text:not_contains_in_file path=plugins/ae/skills/work/SKILL.md] `## Ceremony preset → stage-skip table` (bundling table canonical = pipeline.template.yml only per MCE plan-review Q1; both Doodlestein agents flagged AC2/Step 2 contradiction in original plan draft, fixed to MUST_NOT here)

### SHOULD

#### Cross-file consistency (codex plan-review #4)

- [text:contains_in_file path=plugins/ae/skills/work/SKILL.md] each of `work.agent_teams`, `work.review_mode`, `work.accumulated_doodlestein` appears at least once in the file's prose (matches template's 5-stage list for work skill)
- [text:contains_in_file path=plugins/ae/skills/plan/SKILL.md] each of `plan.plan_review`, `plan.doodlestein` appears at least once in the file's prose (matches template's 5-stage list for plan skill)

#### README discoverability (gemini plan-review #2 + challenger plan-review #2 + codex plan-review #5)

- [text:contains_in_file path=README.md] inline YAML example block containing `ceremony:` field
- [text:contains_in_file path=README.md] explanation of the 3 values + bundling effect (or link/path to pipeline.template.yml for full schema)
- [text:contains_in_file path=README.md] env-var precedence rule mentioning `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and ceremony preset together

### Backward compat (load-bearing per architect plan-review #3)

This MUST section is the structural enforcement for "default: full" backward compat. AC5 of F-013 plan depends on these grep-style checks catching any future regression where a writer accidentally drops `default: full` from a read site.

- [text:count>=3 in_file path=plugins/ae/skills/work/SKILL.md] `default: full` (3 ceremony read sites must each carry the fallback)
- [text:count>=2 in_file path=plugins/ae/skills/plan/SKILL.md] `default: full` (2 ceremony read sites must each carry the fallback)
