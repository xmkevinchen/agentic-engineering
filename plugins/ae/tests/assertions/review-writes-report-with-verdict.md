---
id: review-writes-report-with-verdict
target: ae:review
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [team:exists] TeamCreate call for review team (team name matching `<feature>-review` or similar)
- [behavior] Review team includes challenger (pure opposition) per ae:review Step 3 mandate
- [behavior] Cross-family proxy spawned for at least one enabled proxy (codex in this fixture; gemini only if reachable)
- [file:exists] Review report file created under `output.reviews/` (e.g., `NNN-test-plan-review.md`)
- [file:contains] Review report frontmatter has `verdict: pass` OR `verdict: fail` (required field per ae:review Output spec)
- [file:contains] Review report frontmatter has `target:` field pointing to the plan path
- [file:contains] Review report body has Outcome Statistics section with rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate
- [behavior] Plan frontmatter updated: `status: done` after review passes (Completion Invariant)

### MUST_NOT
- [behavior] MUST NOT spawn the review team without challenger (challenger is always-required per Step 3)
- [file:contains] Review report MUST NOT have empty `verdict:` — must be pass or fail, enables /ae:dashboard + /ae:next to read completion
- [behavior] MUST NOT leave any UNRESOLVED deferred findings (Check 4 hard-blocks verdict write if UNRESOLVED entries exist)

### SHOULD
- [file:contains] Review report includes Disagreement Value Assessment where reviewers disagreed
- [file:contains] Review report lists P1/P2/P3 classification of findings
- [behavior] TL sends shutdown_request to all reviewers after synthesis, then TeamDelete (SKILL.md Step 5)
