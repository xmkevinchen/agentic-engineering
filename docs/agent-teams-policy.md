# Agent Teams Policy — Fallback vs Refuse

When the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable is unset, each AE skill must decide whether to auto-fallback to solo execution or refuse outright. This document codifies the criterion AE uses, the full 12-skill matrix, the carve-outs that don't fit the criterion cleanly, and the contract that solo mode must satisfy.

## Criterion

**Framing B — "Gate-keeper output = refuse; artifact-producer output = fallback."**

A skill is a **gate-keeper** if its primary output blocks downstream actions in a load-bearing way. Examples: `/ae:plan-review` writes `status: reviewed` which `/ae:work` requires; `/ae:review` writes `verdict: pass` which closes the feature archive gate; `/ae:test-plugin` writes assertion results that downstream checks (e.g., `/ae:review` Check 6) read.

A skill is an **artifact-producer** if its primary output is something a human reads and acts on, without a downstream system mechanically consuming a status/verdict field. Examples: `/ae:plan` writes `status: draft` (the draft is for review, not for blocking); `/ae:analyze` writes `analysis.md` (informational); `/ae:work` produces commits (the work IS the output, not a gate).

**The decision rule**: a skill refuses if its solo execution would produce a gate-keeper output that downstream systems would consume as if it were multi-agent-vetted. A skill auto-falls back to solo if its solo execution still produces a meaningful artifact (lower confidence, fewer perspectives) that a human can review.

## 12-Skill Matrix

| Skill | Load-bearing? | Behavior | Today | Solo behavior summary | Wrong-fallback failure mode |
|---|---|---|---|---|---|
| `analyze` | no | fallback | fallback | TL conducts analysis directly, lower confidence | analysis lower quality but structurally valid |
| `discuss` | no (advisory artifact) | refuse (Framing A carve-out — see below) | refuse | n/a | solo discussion is fundamentally different artifact, not a degraded version |
| `plan` | no | fallback | fallback | TL writes plan directly, stays `status: draft` | plan unreviewed; downstream gate (`plan-review`) catches |
| `plan-review` | yes (`status: reviewed`) | fallback BUT does not promote draft→reviewed in solo | fallback (promotes) | TL reviews inline; plan stays `status: draft` | bypass of `/ae:work` quality gate; this F-027 fixes |
| `work` | no | fallback | fallback | TL executes TDD solo per Check 3 fallback | reduced parallelism, no parallel review |
| `review` | yes (`verdict: pass\|fail`) | refuse | refuse | n/a | review verdict cannot be solo |
| `test-plugin` Layer 2 | yes (assertions) | refuse (Framing A carve-out) | refuse | n/a | blind protocol broken |
| `test-plugin --regression --layer1` | no (static analysis) | fallback (solo carve-out for L1-only path) | refuse | TL runs L1 regex/grep checks directly | small risk: L1 only verifies prose, not behavior |
| `consensus` | no (advisory) | refuse (Framing A carve-out) | refuse | n/a | mediation undefined without parties |
| `team` | no | fallback | fallback | TL executes ad-hoc directly | reduced parallelism |
| `testgen` | no | fallback | fallback | TL generates tests directly | lower coverage breadth |
| `think` | no | fallback | fallback | TL reasons directly | no cross-family check |
| `trace` | no (read-only) | check removed | fallback (decorative) | TL traces directly; check never gated team spawn | n/a — check is no-op |

## Framing A carve-outs

Three skills are refused under Framing B but not because their output is gate-keeping. They are refused because their multi-agent protocol *is the value* — the ceremony itself cannot be solo-substituted. We call these **Framing A carve-outs**: their structural mechanism (multi-agent protocol required) overrides the Framing B output-shape analysis.

- **`/ae:discuss`** — the debate protocol requires Round 0 framing, UAG falsification passes, and Doodlestein post-conclusion challenges; solo `discuss` is a TL monologue, categorically a different artifact, not a lower-quality version of multi-agent discussion.
- **`/ae:consensus`** — mediation between agents has no meaning without parties. A "solo consensus" is a TL decision dressed in consensus language; misleading.
- **`/ae:test-plugin` Layer 2** — blind protocol isolation requires `TeamCreate` to keep prompts-writer and answer-writer separate. Without team isolation, prompts and assertions can mutually contaminate.

External users reading these refusal messages should not interpret them as "you're missing a feature" — the refusal is a correctness guarantee: solo execution of these three protocols would silently produce a different artifact than the multi-agent version.

## How to judge a new skill

When adding a new AE skill, decide its Agent Teams behavior with this 3-question checklist:

1. **Does this skill produce a status/verdict/assertion field that another skill mechanically consumes as a gate?**
   - Yes → refuse (Framing B gate-keeper)
   - No → continue to question 2
2. **Is this skill's protocol structurally multi-agent (blind isolation, debate, mediation) such that solo execution would produce a categorically different artifact?**
   - Yes → refuse (Framing A carve-out — document explicitly in this doc)
   - No → continue to question 3
3. **Would a solo execution still produce a meaningful artifact a human can review?**
   - Yes → fallback (Framing B artifact-producer)
   - No → escalate; the skill may not be appropriately scoped for AE

### Worked example — hypothetical `ae:brainstorm`

Imagine a new skill `/ae:brainstorm` that produces a markdown file of feature ideas tagged with theme + estimated size. Walk the checklist:

1. Does `/ae:brainstorm` produce a gate-keeper field? No — the output is `brainstorm.md`, read by humans during roadmap planning. No downstream skill mechanically consumes a status field.
2. Is the protocol structurally multi-agent? No — a single TL can generate ideas; multi-agent makes the list more diverse but does not change the artifact's shape.
3. Would solo execution produce a meaningful artifact? Yes — TL-only brainstorm produces a smaller idea list, but still useful and reviewable.

**Verdict**: `/ae:brainstorm` is a Framing B artifact-producer → **fallback**.

This walk-through anchors the checklist's application. New skills at the carve-out boundary (e.g., a hypothetical `/ae:vote` skill mediating between project members) should be documented under [Framing A carve-outs](#framing-a-carve-outs) explicitly, not inferred from the checklist alone.

## Solo mode contract

Solo mode (no Agent Teams) operates under three contract clauses:

1. Solo runs MUST NOT produce a `status: reviewed` plan.
2. Solo runs MUST NOT produce a `verdict: pass` review.
3. Solo runs MUST NOT produce a passing assertion suite (Layer 2 `/ae:test-plugin`).

This is a **convention not mechanically enforced**: enforcement is by skill discipline (per the SKILL.md spec of each skill), not by frontmatter probes or runtime gating. Future enforcement mechanism (a `reviewed_by: agent-teams` frontmatter field, validated by `/ae:work` Check 1) is tracked in follow-up backlog and targeted for v0.11.x.

Manual frontmatter promotion of `status: draft` → `status: reviewed` outside Agent Teams mode is a contract violation; it bypasses the gate with no audit trail. A user who needs the gate cleared should enable Agent Teams (a 2-line edit to `~/.claude/settings.json`) and re-run `/ae:plan-review`, not hand-edit the plan.

## Two fallback dimensions

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is one of two independent fallback triggers in AE. See [`cc-plugin-contract.md`](references/cc-plugin-contract.md) for the canonical 4-class failure taxonomy:

- **Branch A — env var unset**: this document's scope. User has not opted into Agent Teams; AE skills check the env var and apply the policy in the matrix above.
- **Branch B — `AGENT_TEAMS_FULL = false`**: the env var is set but `ToolSearch("select:Agent")` does not return a schema with `run_in_background`. This is a CC harness capability gap, not a user opt-out. Currently only `/ae:work` Check 3 has explicit Branch B handling (degrades to solo TDD); other skills may behave inconsistently when the env var is set but `run_in_background` is missing.

Branch B is out of scope for the current policy doc; it is a separate degrade tier addressed in `/ae:work` Check 3 directly. F-027 does not unify Branch A and Branch B behavior — that is deferred follow-up work.
