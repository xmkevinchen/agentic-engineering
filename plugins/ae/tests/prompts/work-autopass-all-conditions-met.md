---
id: work-autopass-all-conditions-met
target: ae:work
layer: 2
source: generated
---

## Context
- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with `work.review_mode: full` and `test.command: npm test`
- A plan file at `docs/plans/004-feature.md` with:
  - `status: reviewed` in frontmatter
  - Step 1: `- [ ]` with `Expected files: src/feature.ts, src/feature.test.ts`
  - `## Acceptance Criteria` section present
- `git diff --name-only` returns only `src/feature.ts` and `src/feature.test.ts` (matches Expected files)
- `npm test` exits 0 (all tests pass)
- Code review completes with: no P1 findings, no P2-logic findings, cross-family review succeeds (not degraded)

## Prompt
/ae:work docs/plans/004-feature.md

## Prompt Variants
- /ae:work (with inference — only one reviewed plan with pending steps)
