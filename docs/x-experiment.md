# The x experiment — why deletion precedes the rewrite

> **Status: evidence record.** One controlled experiment, run 2026-08-28, that
> settles the sequencing question for v1: the prose layer is cut back **before**
> any further mechanism is built. The underlying measurements are summarized in
> §1; their working notes are unshipped process artifacts.

## 1. The question

AE's skill layer had grown to 24 skills and **8,481 lines** of prose, against
**141** structural controls (69 Kernel refusal codes + 72 executable check
scripts). Measurement showed the prose to be 98% non-repeating and only ~11%
conditional logic — a body of case law, not a program. The open question:
**is that mass load-bearing, or scaffolding?**

## 2. The experiment

A separate plugin, `x`, with one entry (`/x:work`) and a **182-line** workflow
(reproduced verbatim in [`x-workflow.md`](x-workflow.md)):

- five stages (analyze → optional discuss → plan → work → review);
- six ground rules (criteria frozen before work; checks seen red first; the
  author never reviews alone; every finding dispositioned; deliverables on
  disk; done means the human signed);
- exactly **two human gates** (criteria confirmation, completion sign-off);
- a pointer to where roles live instead of a roster or selection rules;
- a short error-handling section that keeps the agent moving except at gates.

No Agent Teams protocol, no selection tables, no per-stage skill documents.

Three benchmark items from this repository's backlog, each with a
**known-in-advance correct outcome**, were run through `/x:work` in fresh
sessions, with an independent session verifying every claim against the tree.

## 3. Results

| run | item | shape | outcome |
|---|---|---|---|
| 1 | a stale work item claiming a validator misrepresented its scope | should die at premise | Died at premise. Found the fix had already shipped the day before, found the item's own citations stale against the tree, closed it. Zero human stops, zero agent spawns, minutes. |
| 2 | three knowledge-index pages declaring fresh while their own checker computed stale | mechanical fix, deterministic pass signal | Suite red→green in 22m35s, 3 path-scoped commits. Its pre-check caught a genuine contradiction between two criteria before the human gate; its review re-ran every falsifier and planted a defect to prove the checks bite. Zero findings. It also caught two defects in the observing session's own work. |
| 3 | a prose review gate that demoted documented subtraction as if it were growth | prose-rule fix, no unit test possible | Ran on a model **two tiers below** runs 1–2, deliberately. Same protocol compliance, same judgment quality: a discrimination fixture pair (same magnitude, opposite verdicts), an honest property-class argument where the historical instance was unlogged, criteria marked `judgement` where mechanical checks were impossible rather than faked. One visible tier difference: the pre-check round was performed but not self-documented in the plan artifact. |

Across all three runs the independent verification found **zero defects** in
x's output. The two suspicions the observer raised were both the observer's own
errors.

**Agent usage:** four spawns total across three runs, all generic subagents
with role, reading list, and one question supplied in the prompt. The
specialized role definitions were consulted once and passed over — role was
cast at spawn time by prompt, and it sufficed.

## 4. What this establishes

1. **The control did not disappear in x — it relocated.** Two gates, a
   deliverable contract per stage, and the repository's executable checks did
   everything the 8,481 lines were assumed to do. The prose mass was not
   load-bearing for these items.
2. **The model-drift hypothesis failed to appear.** The prose volume implicitly
   assumed a model that drifts without dense instruction. On a model two tiers
   weaker, inside this structure, that model did not show up.
3. **The executable checks are the real capital.** Every red→green, every
   planted defect, every scope check in the experiment bit through a script
   that actually runs. The workflow's job was only to put the model in front
   of them.

## 5. Honest limits

- n = 3, all items with known answers; genuinely exploratory work — the shape
  AE ultimately serves — was **not** tested and remains the next benchmark.
- The experiment consumed this repository's existing check infrastructure; in
  a repository without such checks the same 182 lines would have less to bite
  with.
- The comparison baseline is historical AE run data (e.g. a 209.7-minute
  formation against 3.7 minutes of work), not a same-item head-to-head.
- One observing session double-checked everything; its presence found no
  defects, but the runs were not unobserved.

## 6. What it decides

**The big delete comes first, as a factoring rather than a purge:**

- the core contracts to a single workflow document with one unified entry,
  plus the deliverable-location convention;
- cross-family review (the MCP servers, the proxies) and the adversarial
  close-out prompts are kept — their value is in deliberately designed prompts,
  not in the coordination protocol that grew around them, which goes;
- the executable checks are kept and get a guaranteed execution path in
  review, rather than relying on prose instructions to run them;
- project/GTD surfaces leave the core (separate plugin where wanted);
- the Kernel is untouched until after the delete, then handled with restraint —
  its durable part (content identity, append-only ledger) is the persistence
  layer the minimal workflow lacks; its per-scenario gating is not core;
  *(resolved 2026-08-28: an exploratory x run decided the Kernel is archived —
  proven, unconsumed, reopened only on named observed events; tag
  `v1-kernel-archive` is the resurrection point)*;
- the prose case law is not lost by deletion: it remains in git history, with
  the working discussion as its index, and individual rules return only as
  structure or spec when something real hits them again.

Deleting before rebuilding is the point: every line that survives must earn
its place against a measured 182-line baseline, not against the memory of why
it was once added.
