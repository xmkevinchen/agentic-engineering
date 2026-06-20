---
name: ae:loop
description: Back-half leash loop — auto-run work→review→fixup until verdict pass or cap. LLM-driven driver, deterministic skeleton.
argument-hint: "<feature-or-plan-path>"
user-invocable: true
model: opus
---

<!-- ae-output-standards-pointer-v1 -->
Adhere to [AE Output Standards](../../output-standards.md).
<!-- /ae-output-standards-pointer-v1 -->

# /ae:loop — Back-half leash loop (F-048)

Auto-loop `work → review → fixup` until `verdict: pass` or an iteration cap. This is the **back half** of the pipeline (the autonomous zone). The **front half (discuss → plan) stays human** — `/ae:loop` refuses to run unless the plan is already `status: reviewed` (you decide *what* and *how*; the loop only drives *getting it green*).

**Shape (F-048 D4)**: LLM-driven driver with a **deterministic skeleton**. The skeleton is two pure scripts (`parse-review-verdict.sh`, `loop-decide.sh`) — no `claude -p`, no judgment in shell. The judgment (the work, the verdict) is the LLM-driven `/ae:work` + `/ae:review` skills the driver chains. This is NOT a reborn `ae-flow-controller.sh`.

## Pre-check
1. Resolve `<arg>` to a plan (same inference as `/ae:work`). Plan MUST be `status: reviewed` (front half done) → else refuse: "Front half not complete — run /ae:plan-review first. /ae:loop drives only the reviewed back half."
2. Agent Teams must be enabled (the loop spawns `/ae:work` + `/ae:review`). Else refuse.
3. `cap` = `pipeline.yml work.max_fix_loops` (default 3). `auto_pass` = `pipeline.yml work.auto_pass` (default true).

## Self-modification freeze (F-048 Step 2 / D6)
AE-on-AE loops edit `plugins/ae/skills/` as their work — so the loop must not mutate the gate logic it is running on.
- **Gates run from the installed plugin** (the cached/installed `ae` plugin), NOT the working tree the loop is editing — so the running `/ae:work` and `/ae:review` are **frozen for the loop's duration**. The loop's edits land in the working tree and take effect only on the next plugin reinstall.
- **Guard**: do NOT reinstall the plugin mid-loop.
- **Audit**: at loop-start, log the active gate-skill version (`plugin.json` version + `git rev-parse --short HEAD`) so the run records which gate logic it ran under.
- (Setup that runs skills directly from the working tree, not installed: out of MVP scope — flagged for a follow-up.)

## The loop (F-048 Step 3)
```
log active gate-skill version (freeze audit)
iter = 0
loop:
  run /ae:work <plan>        # fixup-mode on re-entry (iter>0): address the prior review's findings
  run /ae:review <plan>      # writes verdict: to the review file
  verdict = parse-review-verdict.sh <review-file>        # pass|fail|invalid
  if test.command (pipeline.yml) is set:                 # D5b deterministic hedge
      run it; non-zero exit → verdict = fail (regardless of judge)
  action = loop-decide.sh <verdict> <iter> <cap>
  case action:
    exit_pass      → STOP, report success (iter fixups)
    dispatch_fixup → iter += 1; if auto_pass → continue; else pause for human "go" (auto_pass:false = human-go per step)
    escalate_cap   → go to Escalation
```
- Work/review are invoked as **LLM skill chains**, never as `claude -p` subprocesses.
- `diverse-judge-AND` comes for free: `/ae:review` already aggregates cross-family (codex+gemini) into its `verdict` — the loop just reads that verdict.

## Escalation — cap exhausted (F-048 Step 4 / D2)
On `escalate_cap`, do NOT exit silently:
1. Emit a "what failed across N iterations" diagnostic.
2. Compute a per-iteration **failure-signature** (hash of the review's findings). If the same signature repeats → set `repeated_failure_signature: true`.
3. **Classify**: *fixable-not-yet-converged* (findings shrinking / changing) vs *structural-plan-wrong* (same signature repeating → the plan/approach is wrong). Structural → **surface to the human for a plan revisit** (a fixup loop can't fix a wrong plan), NOT another fixup.

## Trace emission (final step)
Before exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit the loop outcome (iters, final verdict, escalation class) to `~/.ae/traces/<session-id>.ndjson`.
