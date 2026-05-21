---
id: review-commit-range-target
target: ae:review
layer: 1
source: regression
---

## Context

F-012 adds ad-hoc target support to `plugins/ae/skills/review/SKILL.md`: the Argument Inference becomes a 3-form ladder (file/dir, commit ref/range, empty), the Pre-checks section gains a router (target-mode skips Check 2-5), and the Output section adds case (c) — ad-hoc / re-review writes go to `output.reviews/adhoc/<id>-<ISO8601>.md`. This test verifies the spec text is complete and that no key constraint has been dropped.

## Prompt

Read `plugins/ae/skills/review/SKILL.md` and answer:

1. Does `## Argument Inference` section contain three subsections labeled `Form 1`, `Form 2`, `Form 3`? What does each form match?
2. Does Form 1 explicitly state file-existence wins over commit SHA pattern match? Quote the exact phrase.
3. Does Form 2 list the three patterns: `..` containing string, `^[a-f0-9]{7,40}$`, `^HEAD~?[0-9]*$`? Are all three present?
4. Does Form 3 cover both empty `$ARGUMENTS` AND non-matching free-text? What happens to non-matching free-text?
5. Does the file contain `### Form ambiguity resolution` subsection? Does it require TL to run `test -f` / `test -d` via Bash?
6. Does the file contain an observability trace requirement `[AE-REVIEW] Argument inference:`? Where (start of inference / before pre-checks / before reviewer spawn)?
7. Does the Pre-checks section contain a `Target-mode router` subsection BEFORE Check 1? What does it route on?
8. According to the router, which Pre-checks are SKIPPED in ad-hoc mode? Which are still applied?
9. Does the Output section contain THREE write-target cases (a, b, c)? What does case (c) write to?
10. Is the case (c) path a non-recursive subdirectory (i.e., `output.reviews/adhoc/...`)? Does the file note that dashboard/next/plugin-stats/retrospect do NOT scan adhoc/?
11. Does the file describe TWO frontmatter schemas — pipeline mode (verdict required) vs ad-hoc mode (verdict OMITTED + mode: adhoc)? List the explicit fields for each.
