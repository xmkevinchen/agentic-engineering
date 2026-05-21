---
id: code-review-target-aware-diff
target: ae:code-review
layer: 1
source: regression
---

## Context

F-012 actually wires the `$ARGUMENTS` argument logic in `plugins/ae/skills/code-review/SKILL.md` for the first time. The argument-hint was declared 8 months earlier but Track 1 + Track 4 both hardcoded `git diff + git diff --cached`. The change adds an Argument Inference 3-form section, introduces substitution markers `{{ TARGET_DIFF_CMD }}` and `{{ TARGET_DIFF_OUTPUT }}`, and updates the Track 1 + Track 4 spawn templates to use the markers instead of the hardcoded diff. This test verifies the spec text is complete, that the substitution discipline is documented, and that no marker has been missed.

## Prompt

Read `plugins/ae/skills/code-review/SKILL.md` and answer:

1. Does the file contain a `## Argument Inference` section? Where (between frontmatter and main title `# /ae:code-review`, or somewhere else)?
2. Does Argument Inference contain three subsections `Form 1`, `Form 2`, `Form 3`? What does each match?
3. Does the file contain a substitution table mapping each Form to a `{{ TARGET_DIFF_CMD }}` substitution? List the four rows (Form 1, Form 2 range, Form 2 single SHA, Form 3 empty).
4. Does Form 1 (file/dir path) state file-existence wins over commit SHA pattern match?
5. Does the file contain a `### TL execution discipline (substitution marker)` subsection? Does it state the TL MUST replace markers BEFORE spawning agents?
6. Does the file warn that leaving raw `{{ TARGET_DIFF_CMD }}` token in spawned prompts causes silent failure?
7. In Track 1 (Claude Review) text, is the diff source described as `{{ TARGET_DIFF_CMD }}` (resolved per Argument Inference) — or as the old hardcoded `git diff + git diff --cached`?
8. In Track 4 spawn prompt, what placeholder appears where the inline diff goes? Is it `{{ TARGET_DIFF_OUTPUT }}` or hardcoded `<current diff>`?
9. Does Track 4's surrounding spec text (after the prompt block) restate the substitution discipline?
10. Does the file contain an observability trace line `[AE-CODE-REVIEW] Argument inference:`? Where does it fire (before Track 1 spawn / after / never)?
11. Does the file explicitly state `--reviewer` flag is NOT added to ae:code-review? Why (4-track structure is multi-reviewer by design)?
