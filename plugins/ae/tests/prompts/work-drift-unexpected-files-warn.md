---
id: work-drift-unexpected-files-warn
target: ae:work
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` with `test.command: npm test`, no `work.security_patterns` matching the extra file
- Plan file at `docs/plans/006-drift.md` with `status: reviewed`, one pending step containing:
  - `Expected files: src/api.ts`
- `git diff --name-only` returns: `src/api.ts`, `src/utils/helper.ts` (extra unexpected file)
- `src/utils/helper.ts` does NOT match any `work.security_patterns`

## Prompt
/ae:work docs/plans/006-drift.md

## Prompt Variants
- /ae:work docs/plans/004-logging.md (Expected files: src/logger.ts — git diff also includes src/config.ts)
