---
id: discuss-steering-readout-required
target: ae:discuss
layer: 1
source: regression
---

## Context

F-036 adds a required user-facing Steering Readout to `plugins/ae/skills/discuss/SKILL.md` §6 (Present Results to User & Record). The readout is the correction-window mechanism: TL surfaces its triage (stakes × reversibility) and pacing judgment to the user every round, in plain language. It is decision-first (TL judgment leads, redirect-CTA secondary), mandatory (no silence), and its detail scales with contention (one-line form only when all topics converge). A §3 pointer ties triage to this readout. This test verifies the spec prose is present and the enforcement properties are stated — NOT that the readout executes at runtime (L1 asserts prose, per F-034).

## Prompt

Read `plugins/ae/skills/discuss/SKILL.md` and answer:

1. Does §6 contain a `## Steering Readout` reference introduced as a REQUIRED / MANDATORY user-facing block? Is the requiredness stated in live prose (not only inside a ``` code fence)?
2. Is the readout decision-first — does the spec say TL's triage judgment leads and the "redirect?" CTA is secondary (not an A/B/C options dump, does not hand the decision back)?
3. Does the readout's three parts list Triage before the Redirect CTA?
4. Does the triage instruction name the ranking dimension explicitly (stakes × reversibility)?
5. Is there a "no silence" rule (readout mandatory every round; write an explicit "no triage" line rather than omit)?
6. Is there a "detail scales with contention" bound — one-line whole-readout form legal ONLY when all topics converge, and any deep-dived / open-disagreement topic requires a substantive (no-boilerplate) triage entry?
7. Does §3 (Discussion Rounds, TL moderator) contain a pointer that TL triages by stakes × reversibility after exploration and surfaces it in the Step 6 Steering Readout?
8. Is the readout block free of internal bookkeeping terms in its user-facing text?
