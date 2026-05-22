---
id: plan-review-solo-preserves-draft
target: ae:plan-review
layer: 1
source: generated
---

## Context

F-027 Cliff 1+3 fix: solo `/ae:plan-review` is best-effort feedback only — it MUST NOT promote plan frontmatter from `status: draft` to `status: reviewed`. Only Agent-Teams-mode plan-review may promote. This prevents the upstream half of the solo-chain quality-gate bypass (solo plan → solo plan-review → /ae:work).

## Prompt

Read the ae:plan-review SKILL.md Pre-check 1 and Apply and Confirm sections. Describe what happens to plan frontmatter `status` when `/ae:plan-review` runs under solo conditions (env var unset).

## Prompt Variants

- What status does ae:plan-review leave the plan in when Agent Teams is disabled?
- Can solo ae:plan-review promote a draft plan to reviewed?
