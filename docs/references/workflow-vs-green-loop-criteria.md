# When a CC workflow is justified for the harness back-half (vs the in-session green-loop)

> Spike outcome (BL-152, part of the "harness every step" program). **Decision criteria, not a commitment.** The harness green-loop (TDD-style: not-all-green = not-done) stays the PRIMARY driver of the back-half; a TL-authored CC workflow is a *situational* escalation — "根据情况上 workflows", never a migration target.

## The one thing a workflow buys

A CC workflow is "thought-crystallized / form-dynamic" made real: the TL authors a TypeScript orchestration per task and a **deterministic runtime executes it**. That runtime is the ONE thing that removes the **ignition turtle** — it starts and drives the loop with no per-iteration LLM choice to continue. F-050's in-session, TL-driven green-loop cannot do this: the TL must still *start* the loop (the residual F-050 documents honestly).

## The one thing a workflow CANNOT do

A workflow runs agents as **parallel monologue**, not adversarial debate. It cannot reproduce Agent-Teams **cross-family challenge/rebuttal depth** (F-030 finding + [[feedback-workflow-vs-agent-teams-contingency]]). The **review half needs that depth** (cross-family bite-review, doodlestein, challenger). So a workflow is a contingency for the *mechanical* half, not the *judgment* half.

## Use a workflow when (most must hold)

- **Ignition-turtle cost is material** — a stalled loop during a long *unattended* run is expensive.
- **The stage is mechanical fan-out** — many parallel agents/tools run the same bounded procedure.
- **Sequencing is deterministic** — the next step follows from state, not mid-loop LLM judgment.
- **Outputs validate by deterministic checks** — schemas, tests, fixed acceptance gates (e.g. `node_check`/`verify_by: contract`).
- **Token/wall-clock cost is high enough** that removing per-iteration resumption pays for the orchestration overhead.
- **Breadth > depth** — many independent branches, low need for rebuttal.

## Stay on the green-loop / Agent Teams when (any holds)

- **The stage needs adversarial challenge/rebuttal** across families — especially review/critique.
- **Mid-loop judgment is central** — the TL must reinterpret evidence, redirect agents, change strategy.
- **The loop is short / interactive / cheap** — ignition-turtle cost is negligible.
- **Parallelism needs real debate**, not monologue fan-out.
- **The outcome depends on synthesis quality** — conflict resolution, deciding which critique is right.

## The real edge case (apply criteria at sub-stage granularity)

When a stage *mixes* mechanical fan-out with embedded judgment checkpoints, do NOT pick one mode globally. **Split the stage**: route the mechanical slice to a workflow, keep the judgment checkpoint in-session (Agent Teams). The criteria above apply per sub-stage, not just per stage.

## Net

Workflow = contingency for the mechanical, wide, deterministic, unattended slices of the back-half. The green-loop + Agent Teams remain primary for everything judgment- or debate-shaped. Don't over-push the workflow path.
