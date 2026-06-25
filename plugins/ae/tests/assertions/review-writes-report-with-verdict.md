---
id: review-writes-report-with-verdict
target: ae:review
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [team:exists] Review teammates spawned via the Agent tool (each with a `name` param making it addressable); no TeamCreate
- [behavior] Review team includes challenger (pure opposition) per ae:review Step 3 mandate
- [behavior] Cross-family proxy spawned for at least one enabled proxy (codex in this fixture; gemini only if reachable)
- [file:exists] Review report file created — either at `<feature-dir>/review.md` (Plan 051+ when target plan is feature-dir-resident) OR at `output.reviews/NNN-test-plan-review.md` (legacy when target plan lives under `output.plans/`).
- [file:contains] Review report frontmatter has `verdict: pass` OR `verdict: fail` (required field per ae:review Output spec)
- [file:contains] Review report frontmatter has `target:` field pointing to the plan path
- [file:contains] Review report body has Outcome Statistics section with rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate
- [behavior] Plan frontmatter updated: `status: done` after review passes (Completion Invariant)

### MUST_NOT
- [behavior] MUST NOT spawn the review teammates without challenger (challenger is always-required per Step 3)
- [file:contains] Review report MUST NOT have empty `verdict:` — must be pass or fail, enables /ae:dashboard + /ae:next to read completion
- [behavior] MUST NOT leave any UNRESOLVED deferred findings (Check 4 hard-blocks verdict write if UNRESOLVED entries exist)

### SHOULD
- [file:contains] Review report includes Disagreement Value Assessment where reviewers disagreed
- [file:contains] Review report lists P1/P2/P3 classification of findings
- [behavior] TL sends shutdown_request to all reviewers after synthesis (SKILL.md Step 5); teammate cleanup is automatic at session end (no TeamDelete)
