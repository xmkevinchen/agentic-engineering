---
id: work-lint-typecheck-checks
target: ae:work
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/work/SKILL.md] A `### C.1 Lint` section consuming `lint.command`, positioned between `### C. Tests Green` and `### C.5 Protocol Invariant Check`
- [file:contains:plugins/ae/skills/work/SKILL.md] A `### C.2 Typecheck` section consuming `typecheck.command`, positioned between C.1 and C.5
- [file:contains:plugins/ae/skills/work/SKILL.md] Empty `lint.command`/`typecheck.command` → soft-skip with a `⚠️ No lint/typecheck command configured, skipping`-style message, described as a plain non-blocking soft-skip (NOT the UNVERIFIED gate-pause that empty `test.command` triggers)
- [file:contains:plugins/ae/skills/work/SKILL.md] Non-zero exit → a P2-logic finding labeled `[C.1 Lint]` / `[C.2 Typecheck]` that enters the Check E disposition set (shown; human chooses fix / defer / backlog)
- [file:contains:plugins/ae/skills/work/SKILL.md] The non-zero-exit finding does NOT set `no_p1 = false` and lint/typecheck are NOT terms in the auto-pass gate expression (the finding is shown but non-gating)
- [file:contains:plugins/ae/skills/work/SKILL.md] The auto-pass gate expression contains no `lint_clean` or `typecheck_clean` term

### MUST_NOT
- [file:contains:plugins/ae/skills/work/SKILL.md] MUST NOT classify a non-zero lint/typecheck exit as a gate-blocking P1 (the brownfield-safe design is P2-not-P1; the gating baseline mechanism is deferred to a follow-up BL)
- [file:contains:plugins/ae/skills/work/SKILL.md] MUST NOT route the C.1/C.2 finding through a separate disposition mechanism that could silently drop when Check D produced no findings (the `[C.1 Lint]`/`[C.2 Typecheck]` label routes it into Check E's existing disposition set)
