---
id: review-writes-report-with-verdict
target: ae:review
layer: 2
source: manual
---

## Context

Fixture state (in worktree):
- `.claude/pipeline.yml` exists, Agent Teams enabled
- A completed plan at `.ae/plans/999-test-plan.md` with all steps `[x]` and `status: reviewed`
- No DEFERRED entries in `.ae/milestones/999/notes.md` (Check 4 passes)
- `test.command` is empty (Check 3 skips with warning)
- `cross_family.codex: true` (Gemini skipped if unreachable)

## Prompt

Execute:
```
/ae:review .ae/plans/999-test-plan.md
```

Per ae:review's Execution flow, must spawn a review team (architecture-reviewer + challenger + cross-family proxies), synthesize findings via TL, and write a review report to `output.reviews/` with a `verdict:` frontmatter field.
