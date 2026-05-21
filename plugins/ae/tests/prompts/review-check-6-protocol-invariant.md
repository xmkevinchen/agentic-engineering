---
id: review-check-6-protocol-invariant
target: ae:review
layer: 1
source: manual
---

## Context

- `/ae:review` Check 6 (Protocol Invariant Check) was added in plan 057 Step 1 (commit `af2c41f`). It is the feature-completion-review-level analog of `/ae:work` Check C.5 (per-commit pre-commit).
- Check 6 fires when `git diff --name-only <feature-base>...HEAD` (cumulative diff across all feature commits) includes files under `plugins/ae/skills/` or `plugins/ae/agents/`.
- Layer 1 failure on the cumulative diff = P1 verdict-blocking finding.
- Trace emission is documented inline: one line per Check 6 firing to `~/.ae/traces/<session-id>.ndjson` (per T1 trace protocol).
- The two checks (C.5 per-commit, Check 6 cumulative) are deliberately layered: C.5 catches step-local drift incrementally; Check 6 catches multi-step interaction drift cumulatively.
- This is a Layer 1 STATIC fixture — it verifies the Check 6 prose persists in `/ae:review` SKILL.md across refactors (regression-proofs against accidental deletion or weakening of the safety surface).

## Prompt

How does `/ae:review` SKILL.md document its Check 6 Protocol Invariant Check: where is the trigger condition, the invocation form, the failure severity, the cross-reference to /ae:work C.5, and the trace emission path documented?
