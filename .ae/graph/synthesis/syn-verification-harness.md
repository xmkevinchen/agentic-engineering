---
id: syn-verification-harness
title: "Verification harness — machines measure, LLM judges, the goal is frozen"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "docs/references/verify-by-kinds.md:1"
    anchor_hash: "# `verify_by` kinds — what a runnable check looks like"
  - source: "plugins/ae/scripts/ae-run-tests.sh:22"
    anchor_hash: "for t in \"$SUITE\"/test-*.sh; do"
    commit: b4cc996
  - source: "plugins/ae/tests/scripts/test-graph-lint.sh:4"
    anchor_hash: "# sh-tap output (parser: sh-tap.v1). Fixture trees are built at runtime in a tmpdir"
    commit: 7571863
  - source: "plugins/ae/skills/plan/SKILL.md:375"
    anchor_hash: "- [ ] **Freeze the GOAL**: for a feature-dir plan, write the verbatim `## Acceptance Criteria` section of this `plan.md` → `<feature-dir>/goal.frozen.md` — the immutable acceptance standard a fresh `/ae:review` re-examines the work against (frozen at plan-approval so the executor cannot move the goalposts during work). Only the GOAL is frozen (AC substance + `verify_by` + `verify:`); the harness/means stay editable in the live plan (goal/harness split deferred). Legacy plans (no feature dir) skip."
---

Every acceptance criterion in a current-convention plan declares which proof kind enforces it — brownfield plans migrate on touch, not retroactively — and the split is load-bearing: deterministic kinds must name a runnable command while judge kinds must state a rubric, with neither substituting for the other (docs/references/verify-by-kinds.md:1). Judgment, unanchored: the reason is a failure class this project hit repeatedly — an AC whose verifier runs but proves nothing. The suite runner itself only executes test files and trusts exit codes (plugins/ae/scripts/ae-run-tests.sh:22); non-vacuity is proven one level up — AC-referenced tests declare the sh-tap contract so the evidence collector can count their ok-lines, making a checker that proves nothing visibly vacuous at review rather than silently green in the suite (plugins/ae/tests/scripts/test-graph-lint.sh:4).

The boundary that makes the loop safe to automate: at plan approval the acceptance section is frozen to a separate file, so the executor can edit the live plan's means but never the goal it will be graded against (plugins/ae/skills/plan/SKILL.md:375). Judgment, unanchored: the deepest property is that every mechanism assigns machines the measuring and reserves meaning for the judge — the harness never asks a script to decide whether something is TRUE, only whether it happened.
