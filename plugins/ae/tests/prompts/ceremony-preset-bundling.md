---
id: ceremony-preset-bundling
target: ae:work, ae:plan
layer: 1
source: regression
---

## Context

F-013 ships single `ceremony: full | light | minimal` field in pipeline.yml controlling 5 ceremony stages with existing solo paths. 3 stages requiring NEW skip code (discuss.framing_review / discuss.doodlestein / review.cross_family) are deferred to Phase 2 BLs. This fixture verifies spec-text presence + cross-file consistency + backward compat across the wired files (Z2/B-restricted design per F-013 discussion conclusion).

## Prompt

Read these files and answer:

1. `plugins/ae/templates/pipeline.template.yml` — does it contain a top-level `ceremony:` field with default value `full`? Does the comment list the 3 valid values (`full` / `light` / `minimal`)? Does the comment enumerate the 5 controlled stages and 3 deferred stages with reasons? Does it state canonical bundling rules (what each preset disables)? Does the `work.review_mode` field comment cross-reference the `ceremony` field for precedence? Quote the precedence comment.

2. `plugins/ae/skills/work/SKILL.md` — how many ceremony preset read sites are present? What sections do they appear in (Check 3 / Check D / Post-commit Doodlestein)? Does each site contain the literal phrase `default: full`? Does each site contain an explicit-wins precedence clause (e.g., "Explicit X wins on conflict if set" or equivalent)?

3. `plugins/ae/skills/plan/SKILL.md` — how many ceremony preset read sites are present? What sections do they appear in (Step 3 Plan Review / Step 4 Doodlestein)? Does each site contain `default: full`? Does Step 3's ceremony interaction note `--skip-review` flag wins on conflict? Does Step 4's ceremony interaction note cross-family unavailable check still wins?

4. `plugins/ae/skills/discuss/SKILL.md` — does this file contain ANY ceremony preset read site? (3 stages discuss.framing_review / discuss.doodlestein are explicitly deferred to Phase 2 BLs, so NO ceremony read site should appear here.)

5. `plugins/ae/skills/review/SKILL.md` — does this file contain ANY ceremony preset read site? (review.cross_family is deferred to Phase 2 BL, so NO ceremony read site should appear here.)

6. Cross-file consistency: does `pipeline.template.yml`'s ceremony comment list exactly the 5 stage names (`work.agent_teams` / `work.review_mode` / `work.accumulated_doodlestein` / `plan.plan_review` / `plan.doodlestein`)? Is each of these 5 names referenced in the corresponding skill prose?

7. Bundling table: does `plugins/ae/skills/work/SKILL.md` contain a "## Ceremony preset → stage-skip table" section or equivalent bundling-rules table? (Per MCE plan-review Q1, the bundling table should be ONLY in `pipeline.template.yml` — single source of truth — and NOT duplicated in skill files.)

8. README.md: does it contain an inline YAML example block showing `ceremony:` field usage? Does the README section explain the 3 values + bundling effect + cross-reference to `pipeline.template.yml`? Does it document env-var precedence (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` overrides ceremony preset)?
