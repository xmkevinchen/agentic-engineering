---
id: work-drift-expected-files-match
target: ae:work
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` with `test.command: npm test`
- Plan file at `docs/plans/005-drift.md` with `status: reviewed`, one pending step containing:
  - `Expected files: src/widget.ts, src/widget.test.ts`
- `git diff --name-only` returns exactly: `src/widget.ts`, `src/widget.test.ts`

## Prompt
/ae:work docs/plans/005-drift.md

## Prompt Variants
- /ae:work (inference from most recent reviewed plan)
