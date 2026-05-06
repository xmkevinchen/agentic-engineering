---
id: setup-library-missing-actionable-errors
target: ae:setup
layer: 1
source: manual
---

## Context

- F-005 (BL-057) shipped Outcome A0+ in v0.9.4: actionable error messages at `/ae:setup agents --list`, `--add`, `--sync` parallel to BL-059's `--suggest` actionable-exit pattern at `setup/SKILL.md:317-321`
- `--list` and `--sync` skip-and-continue; `--add` REFUSES on missing library directory (because `--add` modifies agent state — refusing prevents partial installs)
- `/ae:setup agents --remove` is UNAFFECTED — operates on local `.claude/agents/` + pipeline.yml only, never reads library source
- README has `## Cross-machine setup` block describing 2-step recovery flow; `--list`/`--add`/`--sync` error messages reference it via "See README \"Cross-machine setup\""

## Prompt

How do `/ae:setup agents --list`, `--add`, and `--sync` handle missing library source paths after F-005? Which of these REFUSES vs SKIPS-AND-CONTINUES, and what actionable hint do they emit? Does `--remove` need similar handling?
