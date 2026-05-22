---
id: work-refuses-draft-plan
target: ae:work
layer: 1
source: regression
---

## Context

F-027 Cliff 1+3 fix locks in `/ae:work`'s existing refuse behavior for `status: draft` plans (work/SKILL.md Check 1 already refuses unreviewed plans). This fixture regression-proofs the existing invariant — a future refactor that removed or weakened the `status: draft` refuse would silently re-introduce the solo-chain quality-gate bypass.

## Prompt

Read the ae:work SKILL.md Pre-check Check 1 and describe what happens when a plan has frontmatter `status: draft`.

## Prompt Variants

- Does `/ae:work` execute against a draft plan?
- What status does ae:work Pre-check require on the target plan?
