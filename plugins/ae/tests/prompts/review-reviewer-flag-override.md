---
id: review-reviewer-flag-override
target: ae:review
layer: 1
source: regression
---

## Context

F-012 adds a `--reviewer <name>` flag to `plugins/ae/skills/review/SKILL.md`. Semantics: override (NOT additive) — when any flag is provided, the default selection table is skipped and only the named reviewers spawn. The flag can repeat (multi-flag is additive among the flags, but the set collectively overrides the default). An unknown name is a hard fail. The flag is orthogonal to the `<target>` argument. This test verifies that the spec is complete: WRONG/CORRECT examples are present, a scale anchor explains the default 4-5 reviewer count, and a forward-reference notes the deferred `--add-reviewer` flag.

## Prompt

Read `plugins/ae/skills/review/SKILL.md` `--reviewer flag` section and answer:

1. What is the override semantic — additive (adds to default) or override (replaces default)? Quote the exact phrase that defines this.
2. Are multiple `--reviewer` flags allowed? What happens with `--reviewer X --reviewer Y` — additive between flags?
3. Does the spec contain explicit WRONG / CORRECT examples? What does the WRONG example look like and what does the CORRECT example look like?
4. Does the spec quantify how many reviewers the default selection table typically spawns? (e.g., "4-5 reviewers")
5. What concrete examples follow the scale anchor — what is dropped when user passes `--reviewer challenger` alone?
6. Is there a forward-reference to a future additive variant flag? What is the proposed name and version?
7. What happens with an invalid reviewer name (e.g., typo, agent that doesn't exist)? Hard fail or silent skip?
8. Is `--reviewer` flag combinable with `<target>` argument? Quote the example if any.
9. Does the spec say `--reviewer` is NOT added to ae:code-review? What is the reason?
10. When `--reviewer` flag is present, where does the review write target go (case (a) feature-dir, case (b) legacy, case (c) adhoc)?
