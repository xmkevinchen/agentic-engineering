---
name: plan
description: Generate a feature plan with acceptance criteria + plan review. Recommended: Sonnet or above
argument-hint: "<feature description>"
user-invocable: true
model: opus
effort: high
---

<!-- ae-output-standards-pointer-v1 -->
Adhere to [AE Output Standards](../../output-standards.md) in plan formatting and TL session responses.
<!-- /ae-output-standards-pointer-v1 -->

## Argument Inference

Resolve `$ARGUMENTS` into an optional **source discussion directory** before running Pre-check. Three argument forms (in priority order):

### Form 1 — Discussion-dir path

If `$ARGUMENTS` starts with `.ae/discussions/` or matches `*/discussions/*/` (ends with `/`), accept as-is. Resolve:
- `conclusion.md` path = `<arg>/conclusion.md`
- `framing.md` path = `<arg>/framing.md` (optional, load-if-exists)

Example: `/ae:plan .ae/discussions/047-pipeline-quality-wave-cluster/`

### Form 2 — BL-ID

If `$ARGUMENTS` matches regex `^BL-\d{3}$` (e.g., `BL-033`):

1. Locate the BL file across BOTH locations (Plan 051+ — promoted BLs live inside feature dirs):
   - **Promoted (primary)**: `.ae/features/{active,done,abandoned,paused}/F-*/BL-NNN.md` — when `/ae:analyze` promoted the BL, the file moved into the feature dir.
   - **Backlog (fallback)**: `<output.backlog>/**/BL-NNN*.md` glob, where `<output.backlog>` is read from `pipeline.yml` (default: `.ae/backlog/`; projects with custom paths use their configured value). Traverse `unscheduled/`, `v*/`, `done/v*/` subdirs; exclude `closed/`.

   When the BL is found in a feature dir, Form 2 resolves to that feature dir directly (Form 2 promoted-BL branch of the **Feature context resolution** rule in Step 2). When found only in backlog, the BL is unpromoted; the resolution rule's fall-through branch routes to legacy `output.plans`.
2. Parse the BL file's YAML frontmatter `narrowed_by:` field. **Parse rule**: (a) strip everything from the first space, `+`, or newline onward; (b) strip a trailing `/conclusion.md` if present; (c) ensure the result ends with `/` (append if missing) — this normalizes to Form 1's directory format.
   - Example: `narrowed_by: ".ae/discussions/047-pipeline-quality-wave-cluster/conclusion.md + Addenda 4+5+6"` → after (a) `.ae/discussions/047-pipeline-quality-wave-cluster/conclusion.md` → after (b) `.ae/discussions/047-pipeline-quality-wave-cluster` → after (c) `.ae/discussions/047-pipeline-quality-wave-cluster/`
3. If `narrowed_by:` is missing/empty, fall back to body-text grep for a discussion reference: first match of `\.ae/discussions/[^ ]+/` (already terminates with `/`; skip normalization step c).
4. If no discussion reference resolves → **refuse**: `/ae:plan <BL-ID> — BL file has no resolvable discussion reference (checked frontmatter narrowed_by: and body-text). Supply the discussion directory explicitly: /ae:plan .ae/discussions/NNN-slug/`

Once resolved, treat as Form 1.

### Form 3 — Empty or free-text feature description

If `$ARGUMENTS` is empty:
1. Check `output.discussions` for the most recent discussion with `pipeline.discuss: done` and a `conclusion.md`
2. Found → use that as Form-1 source discussion
3. Not found → check conversation context for a topic being discussed
4. Still nothing → ask user what to plan

If `$ARGUMENTS` is free text (no discussion path, no BL-ID pattern): use as the feature title for a **standalone plan**. No source discussion is resolved; the discussion-dependent Pre-check does not fire; any discussion-dependent quality checks (Plan Quality Self-check and similar) skip as standalone-plan exemption.

### Argument-form error parity

Refusal wording MUST be consistent across Form 1 and Form 2 for the **same terminal condition** (both forms resolve to the same discussion dir, that dir's `conclusion.md` is missing) — both emit Pre-check item 4's "Discussion source valid" refusal. Distinct terminal conditions (Form 2 BL with no resolvable discussion reference at all vs Form 1 or Form 2 with a resolved-but-incomplete discussion) legitimately emit distinct messages targeted at the actionable fix for each.

# /ae:plan — Feature Plan

Create an execution plan for: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:plan creates 6 tasks per invocation. Subjects use canonical format `<skill>: <phase-id>`.

| Phase | Subject | Created at | `in_progress` | `completed` |
|---|---|---|---|---|
| Pre-check | `ae:plan: Pre-check` | Skill start | Before Check 1 | After all pre-checks pass |
| Step 1 | `ae:plan: Step 1 — Research` | Skill start (batch) | Before Research starts | After Research summary written |
| Step 2 | `ae:plan: Step 2 — Write Plan` | Skill start (batch) | Before plan body write | After plan file persisted to disk |
| Step 3 | `ae:plan: Step 3 — Plan Review` | Skill start (batch) | When agent-teams plan-review team spawned | When all reviewer findings received at TL |
| Step 4 | `ae:plan: Step 4 — Doodlestein Challenge` | Skill start (batch) | When Doodlestein agents spawned | When all 3 Doodlestein replies received (strategic/adversarial/regret only — `/ae:plan` spawns the 3-agent subset, not the canonical 4; see agent-teams/SKILL.md § Doodlestein Protocol per-skill asymmetry) |
| Step 5 | `ae:plan: Step 5 — Confirm` | Skill start (batch) | When confirmation prompt prepared | When user confirmation received |

Owner field: omit. On error: stay `in_progress`. With `--skip-review`: Step 3 + Step 4 transition `pending → completed` directly (no `in_progress`, no work done).

At skill start, batch-create all 6 tasks:

```
TaskCreate(subject: "ae:plan: Pre-check")
TaskCreate(subject: "ae:plan: Step 1 — Research")
TaskCreate(subject: "ae:plan: Step 2 — Write Plan")
TaskCreate(subject: "ae:plan: Step 3 — Plan Review")
TaskCreate(subject: "ae:plan: Step 4 — Doodlestein Challenge")
TaskCreate(subject: "ae:plan: Step 5 — Confirm")
```

## Pre-check

1. Confirm `.claude/pipeline.yml` exists
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Run `check-agent-teams.sh` (exit 0 = available; exit 1 = unavailable, prints the reason). If exit 1 → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL writing plan directly (skip Step 3 team review + Step 4 Doodlestein). Plan stays `status: draft`. Output: "Plan created in solo mode. Run /ae:plan-review or enable Agent Teams before using with /ae:work."
4. **Discussion source valid** (fires only when Argument Inference resolved a discussion-dir — Forms 1 and 2 above): verify `<dir>/conclusion.md` exists and is readable. Missing or unreadable → **refuse**: `Referenced discussion has no readable conclusion.md at <path>. Run /ae:discuss to conclude, or supply a different discussion directory.` This Pre-check is the entry gate; Step 1 Research #5 below executes unconditionally because this Pre-check already confirmed the conclusion file exists. Standalone plans (Form 3 free text) skip this check.

## Step 1: Research

1. Read project CLAUDE.md for conventions and constraints
2. Read `docs/` for development plan, architecture, existing decisions
3. Search codebase for related code, models, interfaces
4. Check `output.backlog/**/*.md` (from pipeline.yml) for related items — traverse subdirs (`v*/`, `unscheduled/`); exclude `done/` and `closed/` unless specifically researching historical context
5. **When a source discussion is resolved** (Pre-check item 4 confirms this): the agent's plan-generation prompt MUST contain the full verbatim body of `<discussion-dir>/conclusion.md` as primary input, PLUS `<discussion-dir>/framing.md` body if the file exists (silently skip if absent). "Primary input" = equivalent in role to CLAUDE.md or user instructions, NOT an `@reference`, NOT a summary, NOT a "read if needed" footnote. The agent reasons from these bodies when drafting the plan.

   Context size note: if conclusion.md exceeds ~30KB the agent may truncate and plan quality depends on the visible portion. Layer 1 alone is usually fine; Layer 2 + Layer 3 (downstream phases, future plans) will compound this.

   Downstream validation (applied after the load):
   - Check index.md `pipeline.discuss` — if still `in_progress` → **refuse**: "Discussion not concluded. Run `/ae:discuss` to complete."
   - Has `## Decision Summary` with at least one row where Decision column is non-empty and not "—"? — if no real decisions → **refuse**: "Conclusion has no decisions. Run `/ae:discuss` first."
   - Has `## Process Metadata`? — if missing → **refuse**: "Conclusion missing Process Metadata. May have bypassed discuss flow."
   - Has spawned discussions in `## Spawned Discussions`? → **refuse**: "Unresolved sub-discussions exist. Resolve them before planning."
   - Has deferred topics in index.md but no `## Deferred Resolutions` section? → **refuse**: "Sweep was skipped. Run `/ae:discuss` to resolve deferred items."
   - Has `## Deferred Resolutions` with `explained` items? → warn: "Some decisions based on assumptions. Review assumptions before planning."
   - `Autonomous decisions: 0` AND `User escalations: 0` in metadata → warn: "Discussion may not have been properly conducted (no decisions recorded)."
   - Missing other sections → warn: "Conclusion may be incomplete (missing [section]). Proceed with caution."

   Standalone plans (Form 3 free text — no resolved discussion) skip this entire #5 mandatory load.

6. **Consume the analyze verification table** (F-063 — the front-loaded harness's consumer half): when a feature dir is resolved, read its `analysis.md` `### Verification considerations` table and use it as the **per-AC `verify_by` starting point** when writing the plan's Acceptance Criteria. This is an EXPLICIT consumption step (not an implicit nod): **for each row in the table, either map it to an AC's `verify_by` or record `# dimension dropped: <reason>`** (a rigor-downgrade → `# verify_by override (was X): <reason>`; see the Verification Harness conventions below). It is a **strong convention, not mechanically enforced** — review Check 7 is the correctness backstop and silent partial-mapping is not auto-detected (deferred, BL-179); the convention's job is to make divergence *visible*, closing the F-067 inert-floor gap (produced-but-never-read) without overclaiming mechanical enforcement. **Brownfield**: if `analysis.md` is absent or has no Verification-considerations table (legacy feature predating F-063, or a standalone plan), emit a non-blocking warning and derive `verify_by` from scratch — never block. Plan remains the canonical decider on conflict (see the override / dropped-dimension conventions in the Verification Harness section below).

### 1.5. Prior Context (project knowledge graph)

Run this step after Research (Step 1) and before Write Plan (Step 2). Query = the feature description ($ARGUMENTS) or the referenced discussion's problem statement. (Compact locate-step; canonical long form incl. grep-fallback: analyze/SKILL.md § Prior context.)

1. Regenerate + read the layered index: run `plugins/ae/bin/graph-index-gen.py` (cheap, byte-idempotent), read `.ae/graph/index.md`. Generator fails / no feature dirs → emit `Prior context: unavailable (no knowledge index)` and continue to Step 2.
2. **[LLM]** Theme-pick: semantically read Tier A + the picked themes' TL;DRs against the query; read the survivor node pages (keep the set small — ≤10; thin/empty results → fall back to the canonical long form incl. grep-fallback in analyze/SKILL.md).
3. **[deterministic]** Traverse the survivors' edges ONE hop in a single batched `plugins/ae/bin/graph-neighbors.py <survivor-id ...>` call; read newly-reached feature targets' pages (BL/disc targets cite from the edge `evidence` alone; a survivor with no edges in either direction yields no lines — normal outcome, not an error (traversal is bidirectional: inbound-only nodes surface too); the ≤10 read cap covers the folded targets too).
4. **[deterministic gate]** Synthesis pages (index tier "Synthesis pages", ids `syn-*`) are read only through the pull gate: run `plugins/ae/bin/graph-page-check.py .ae/graph/synthesis/<syn-id>.md` BEFORE reading a page — fresh → read + cite normally; stale → read, but every citation of it carries an inline `[STALE — re-sync via /ae:knowledge-refresh]` flag at the affected item; DEFECT (non-zero exit) → do NOT read the page — fresh vs stale are BOTH exit 0 and are told apart by the final stdout verdict line (`<syn-id>: fresh|stale`), emit one `[DEFECT: <syn-id> not served]` line instead. Rot is never silently served.
5. Present under `## Prior Art from Project Knowledge Base` with provenance per item: `id`, `title`, how located (`theme-pick` / `edge from <id>`), edge `evidence` when edge-located.
6. Factor prior art into plan design — reference relevant prior decisions when they constrain or inform the plan's approach
7. **Write-back hook** (ONE hook, five surfaces — the canonical definition lives in analyze/SKILL.md § Prior context step 9; this step references it, never re-defines it): MANDATORY disposition `write-back candidate: yes/no + <one-line reason>` — novelty/durability judged against existing `syn-*` pages (dependency analysis that surfaced cross-feature architecture no page holds is the yes-shaped case here); yes → route through `add-page`'s judged write path (F-075).
8. **Query record**: append exactly one `query:` record to `.ae/graph/log.md` per the format in analyze § Prior context step 10 (`query: plan …` — the disposition line IS the record's durable payload; append-only).

## Step 2: Write Plan

Apply **Feature context resolution** to determine the write target. This resolution rule is canonical for both `/ae:plan` and `/ae:discuss` — the two skills MUST use identical resolution semantics (do not restate in different words elsewhere).

### Feature context resolution

Given `$ARGUMENTS` (already classified into Form 1/2/3 by Argument Inference), resolve against existing feature directories:

1. **Form 2 (BL-NNN) — promoted BL**: BL file lives in `.ae/features/{active,done,abandoned,paused}/F-NNN-<slug>/` → resolve to that feature dir.
2. **Form 1 (discussion-dir path)**:
   - Discussion path matches `.ae/features/<state>/F-NNN-<slug>/discussions/...` (path-derived) → resolve to that feature dir.
   - Discussion `index.md` carries `feature: F-NNN` (legacy discussion location) → resolve to that feature dir.
3. **Form 3 (free text)**: topic clearly maps to a single existing `.ae/features/{active,paused}/F-NNN-<slug>/` via LLM title-overlap judgment → resolve to that dir (paused features are findable by title — F-032; `discuss`'s delegated restatement mirrors this set). Multiple matches or no match → fall through.
4. **Otherwise** (Form 2 unpromoted BL, Form 3 with no clear match, Form 1 with neither path-derive nor frontmatter resolution) → no feature dir resolved.

### Write target

- **Feature dir resolved** → write `<feature-dir>/plan.md` (singular at the feature level). Frontmatter `feature: F-NNN` is OPTIONAL on feature-resident plans (path-derived ID is canonical); when present, readers validate that frontmatter matches the parent dir's `F-NNN` and warn on mismatch — **path always wins**.
- **No feature dir** → write to `pipeline.yml` → `output.plans` (default: `.ae/plans/`) using filename `NNN-slug.md` (legacy fallback). No `feature:` field set.

### Structure

```markdown
---
id: "NNN" # legacy fallback only; feature-dir plans MAY omit (path is canonical)
title: "<title>"
type: plan
created: YYYY-MM-DD
status: draft # Valid status: draft | reviewed | done | cancelled
discussion: "" # path to source discussion directory (e.g., ".ae/discussions/029-slug/" or "<feature-dir>/discussions/<id>-slug/")
feature: "" # OPTIONAL on feature-resident plans (e.g., "F-002"); empty/absent on legacy plans
---

# Feature: <title>

## Goal
One sentence: what problem does this feature solve.

## Steps

### Step 1: <description> (AC1)
- [ ] Subtask a
- [ ] Subtask b
Expected files: path/to/file1.ts, path/to/file2.ts ← REQUIRED: list all files this step will modify

### Step 2: <description> (AC2, AC3)
- [ ] Subtask a
Expected files: path/to/file3.ts ← REQUIRED: enables drift detection in /ae:work

## Acceptance Criteria

### AC1: Reference Case — <description>
- verify_by: unit          # unit|integration|e2e|contract|judge|manual — see Verification Harness mapping below
- fixture: per-feature     # per-feature|project
<Specific known input/output pairs>

### AC2: Sanity Check — <description>
- verify_by: integration
- fixture: per-feature
<Metric + reasonable range>

### AC3: Output Verification — <description>
- verify_by: judge         # judge ACs MUST state a pass-criterion/rubric below
- fixture: per-feature
<Human-verifiable output — with the rubric question the reviewer answers>
```

### Rules
- ACs must be **specific and verifiable** (no "results should be reasonable")
- Numbers must have ranges ("10-15%"), not point values ("12%")
- Each step references AC numbers (step-AC mapping)
- Each AC covered by at least one step
- Each step ≤ 3 ACs

### Verification Harness (per-AC `verify_by` + `fixture`)

Every AC declares two fields — this is the feature's verification harness, carried in the AC section AE already has (not a parallel system):

- `verify_by`: `unit` | `integration` | `e2e` | `contract` | `judge` | `manual` — which proof kind enforces this AC.
- `fixture`: `per-feature` (scaffolding, default) | `project` (reusable — surfaced for promotion at `/ae:retrospect`).

**Claim→track mapping** (the deterministic-vs-LLM line sits at the *claim*, not the artifact — a prose/SKILL.md AC can still have deterministic sub-claims):

| AC kind | `verify_by` | how it's enforced |
|---|---|---|
| Reference Case | deterministic (`unit` / `integration` / `e2e`) | test runner; hard-block at `/ae:work` when `test.command` empty |
| Output Verification | `judge` | review-stage judge against the AC's stated rubric |
| Sanity Check | author picks (deterministic / `contract` / `judge`) | per the chosen value |
| Business-data / domain invariant | `contract` (deterministic) or `judge` | `contract`: jq-assertion runner; `judge`: review rubric |

- **`judge` ACs MUST state a pass-criterion (rubric question)** in the AC body — a bare `verify_by: judge` with no criterion is rejected at `/ae:plan-review` (otherwise it's vibes-as-enforcement, not a harness).
- **`judge` ACs MUST also declare `judge-class: fact-claim | form`** (author self-declared; `/ae:plan-review` is the backstop). `fact-claim` = the AC asserts something is TRUE about the system/data/world (accuracy, faithfulness, semantic correctness — e.g. "the synthesis page's claims match the code they anchor into"); `form` = the AC asserts the output has a shape/quality (readability, template conformance, style — e.g. "a mechanism-naive reader can tell WHICH cited content is stale"). The class decides the rubric's strength contract:
  - **`form` rubrics** keep the one-question shape — a single pass-criterion the judge answers from the artifact alone. Cheap on purpose; no re-derivation tax.
  - **`fact-claim` rubrics MUST name three things** (a rubric satisfiable by inspecting the artifact's self-consistency alone is rejected at `/ae:plan-review`): **(a) the source set** the judge reads FIRST — before the artifact (two-pass, anti-anchoring: the judge forms its own understanding, then compares); **(b) the claim-by-claim output shape** — per material claim: verdict, evidence cite, the judge's own re-derived answer (a holistic pass/fail with no claim records is not a valid fact-claim verdict; the output shape is the enforceable surface — fabricated citations are spot-checkable, free-text "pass" is not); **(c) cross-family / fresh-context judging when the judged artifact is self-authored** (same-family review catches form, never its own confabulations). Within the artifact, MATERIAL claims (architectural, causal, normative, comparative) are checked exhaustively; trivial/transitional claims may be sampled — tiering keeps cost proportional. The lever priority is source access > claim-by-claim output shape > judge independence > rubric wording; the class contract encodes the first three because wording alone is never load-bearing.
- **Non-code dimensions** (business-data validity, domain invariants, BDD/behavioral scenarios): `verify_by: judge` + a rubric is the **general fallback** — the review-stage judge (Check 7) adjudicates the rubric against the actual output. For data/invariant dimensions that are *deterministically checkable*, prefer `verify_by: contract` (a declarative-spec check — see below) over judge.
- **`verify_by: contract`** (deterministic declarative-spec check for data / domain invariants): the AC declares a `spec:` field naming a **jq-assertion spec file** (jq filters asserting ranges / uniqueness / invariants over the feature's data output). The LLM *instantiates* the spec for this feature — **instantiate boundary values, not "easy" ones** (a range assertion must exercise min/max, not a trivially-passing midpoint). A deterministic runner (`verify-contract.sh`, run as a `test.command` target — concretely: `test.command: "verify-contract.sh <spec.jq> <sample.json>"`) executes the assertions: exit 0 = all pass, non-0 = violation → the AC fails. `contract` is a **deterministic kind** (like unit/integration/e2e) for Check 7 + the `/ae:work` hard-block. The LLM fills a human-authored spec *shape* — it does NOT free-generate checks (the self-grading guard: shape is authored, not generated). **propose ≠ judge**: the stage that *proposes/instantiates* the spec (analyze/work) is never the stage that *judges* satisfaction (review Check 7). In the normal pipeline these are separate skills/stages (practical separation); for a hard guarantee, run them as separate Agent-Teams agents with isolated context — the context-isolation enforcement F-049's own AC6 demonstrated. (Honest scope, challenger Ch4: the separation is by-stage, made *structural* via context isolation when the independence claim is load-bearing — not a mechanical same-process lock.)
- **Brownfield rule**: a missing `verify_by` is a plan-validity failure for plans created or revised *after* this ships; legacy in-flight plans are migrated on touch (add the fields before new work starts) — not retroactively invalid.
- **Runnable-check mandate (HDD)**: every **deterministic** `verify_by` AC (`unit`/`integration`/`e2e`/`contract`) MUST declare a `verify:` line naming the command (e.g. `verify: sh tests/x.sh` — the command MAY invoke the project `test.command`). See [`docs/references/verify-by-kinds.md`](../../../../docs/references/verify-by-kinds.md) for what a runnable check looks like per kind. `/ae:plan-review` enforces this mechanically via `check-harness.sh` — a **completeness lint** (the `verify:` line is *declared*), NOT a coverage check. Coverage is judged at `/ae:review` from the **evidence record** `collect-ac-evidence.py` emits ("machines measure, LLM judges meaning"). A deterministic claim with nothing to run is vacuous. `judge`/`manual` ACs are exempt (artifact/human, not shell).
- **`human-gate: true | false` (per STEP, derived)**: at plan time `/ae:plan` derives each `### Step N` block's `human-gate` from that step's ACs' `verify_by` — **any `judge`/`manual` AC → `human-gate: true`** (a human node: the loop pauses here for human confirmation / feature-level review, does NOT auto-advance); **all-deterministic (`unit`/`integration`/`e2e`/`contract`) → `human-gate: false`** (an *auto* node: the loop advances on its mechanical check). Write the derived value as a `human-gate: true|false` line inside the step block. Derived by default — do not require authors to hand-write it (the LLM fills it from the actual AC kinds).
- **Analyze-table consumption + divergence (F-063)**: when planning from a feature whose `analysis.md` carries a Verification-considerations table (consumed in Step 1 Research item 6), **plan WINS at AC granularity** over the analyze suggestion — plan is canonical. Record divergence inline in the AC body so review sees it was deliberate: a downgrade-in-rigor vs the analyze suggestion → `# verify_by override (was <X>): <reason>`; an analyze dimension you map to no AC → `# dimension dropped: <reason>`. These are a **strong convention with review Check 7** as the correctness backstop — NOT enforced per-AC mapping (Check 7 judges evidence against the declared `verify_by`; it does not diff plan ACs against the analyze table — that auto-detection is deferred, BL-179). Brownfield/standalone (no table) → these conventions simply don't apply.

### Plan Quality Self-check

After writing the plan, verify before proceeding to review:

1. **Step completeness**: Does every step have a clear completion condition? (not just "implement X" — what specifically is done when it's done?)
2. **AC verifiability**: Does every AC have a concrete verification method AND declare `verify_by` (with a stated rubric for `judge` ACs)? (test command, manual check, metric threshold — not "results should be reasonable")
3. **Evidence for drift detection**: Does every step list the files expected to be modified? (This enables Phase 2 contract extraction for drift detection during `/ae:work`)
4. **Decision coverage** (discussion-referenced plans only; standalone plans skip this check as a documented exemption): for each row in `<discussion-dir>/conclusion.md`'s `## Decision Summary` table, confirm the plan body either (a) cites the Topic text, (b) maps the decision to a plan step or AC, or (c) explicitly records it under a "## Decisions not implemented" section with a stated reason. Heuristic grep: for each Decision Summary Topic, run `grep -F "<topic text>" <plan-file>` — missing match is a signal, not a proof. **Missing coverage on a discussion-referenced plan → emit P2 warning, do NOT auto-block**. Plan author disposes (fix plan body OR add "Decisions not implemented" section with reason). Prose-only heuristic; intentionally not a semantic guarantee (per failure case 2 LLM-theater bound).

If any check fails → fix the plan before proceeding to review. These checks are self-checks by the writing agent, not a separate review step.

## Step 3: Agent Teams Plan Review

**Skip with `--skip-review`**: If the user passed `--skip-review` flag, skip this entire step and proceed to Step 4 (Doodlestein) or Step 5 (Confirm). Use when: simple changes where full 5-agent review is overhead.

**Ceremony preset interaction (F-013)**: Read pipeline.yml → ceremony (default: full). If ceremony is `minimal` (light does NOT skip plan review) → treat as `--skip-review` (same skip path, same task transitions). `--skip-review` flag wins on conflict if passed. Non-conflict path: `ceremony: minimal` enables skip-review as project-level baseline; explicit `--skip-review` flag at call time is always honored regardless of ceremony value.

> Note: Plan stays `status: draft`. Use `/ae:plan-review` before `/ae:work`.

After the plan is written, spawn teammates for parallel review.

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. For plan review, the "Plan review" row applies as baseline (architect + dependency-analyst). Add more based on plan content (e.g., plan involves DB migration → add performance-reviewer).

**Cross-family**: Follow the cross-family rules in the **Agent Selection Reference** skill — different angles per proxy, focused on the plan's domain. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

**Before spawning teammates** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

```
# Architect reviews plan structure and dependencies:
# architect: dispatcher-resolved default; project_agents override applies (per ae:agent-selection canonical placeholder convention)
Agent(subagent_type: "<per agent-selection>", name: "architect",
      run_in_background: true,
      prompt: "📋 Cast: <runtime-selected>
                  Role: architect (plan review)
                  Angle: step decomposition + dependency graph + parallel strategy
                  Why: mandatory baseline per plan review selection table

               Review this plan's step decomposition and dependencies: <plan full text>.
               Produce step dependency graph and parallel strategy.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "<reviewer-2>", name: "<reviewer-2>",
      run_in_background: true,
      prompt: "📋 Cast: <reviewer-2>
                  Role: <plan review secondary>
                  Angle: <review focus per plan content>
                  Why: <slot rationale based on plan domain — DB migration → perf, etc.>

               <review focus>. SendMessage findings to team-lead when done.")

# Cross-family — for each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family plan reviewer (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; complements core review

               <assigned angle>: <plan full text>.
               SendMessage findings to team-lead when done.")
```

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference.

### TL Merges Results

TL collects findings from all reviewers + cross-family, synthesizes:

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Modify plan based on results. Update plan frontmatter `status: reviewed`.

## Step 4: Doodlestein Challenge (optional)

**Ceremony preset interaction (F-013)**: Read pipeline.yml → ceremony (default: full). If ceremony in {light, minimal} → skip Doodlestein challenge entirely (log: `[Doodlestein challenge skipped: ceremony preset=<value>]`). Existing cross-family unavailable check wins on conflict (skip if either condition holds).

Before confirming with the user, check cross-family availability (`cross_family` in pipeline.yml):

- **Cross-family available** → run Doodlestein challenge on the plan:
  - Compile: plan title + step summaries + AC list + key review findings
  - Spawn the Doodlestein agents INTO the existing plan-review team. **Note**: at the plan-review stage `/ae:plan` spawns only the **3-agent subset** (strategic / adversarial / regret) shown below — NOT the canonical 4. `scope-reducer` is post-conclusion-specific and intentionally omitted here (see agent-teams/SKILL.md § Doodlestein Protocol per-skill asymmetry). "Canonical" in agent-teams context means 4; in plan-review context it means this 3-agent variant.
    ```
    Agent(subagent_type: "doodlestein-strategic", name: "doodlestein-strategic",
          run_in_background: true,
          prompt: "📋 Cast: doodlestein-strategic
                      Role: plan reviewer (strategic)
                      Angle: single smartest improvement to the plan
                      Why: catch missed alternatives before /ae:work commitment

                   <compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

    Agent(subagent_type: "doodlestein-adversarial", name: "doodlestein-adversarial",
          run_in_background: true,
          prompt: "📋 Cast: doodlestein-adversarial
                      Role: plan reviewer (adversarial)
                      Angle: blind spot / first cliff in plan execution
                      Why: predict downstream Step N failures before plan freeze

                   <compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

    Agent(subagent_type: "doodlestein-regret", name: "doodlestein-regret",
          run_in_background: true,
          prompt: "📋 Cast: doodlestein-regret
                      Role: plan reviewer (regret prediction)
                      Angle: highest-regret plan decision likely reversed within 30d ship
                      Why: surface reversal cost before lock-in to step sequence

                   <compiled plan summary + file paths to read>
                   IMPORTANT: STAY IN THE TEAM. Do NOT exit.")
    ```
  - TL routes challenges to original review team members for response (per ae:agent-teams Doodlestein Protocol)
  - Valid challenge → modify plan accordingly
  - Refuted → record in plan review summary
- **Cross-family unavailable** → skip:
  ```
  ℹ️ Doodlestein challenge skipped: cross-family unavailable.
  ```

Shut down teammates (shutdown_request → shutdown_response) after Doodlestein completes (or after Step 3 if Doodlestein skipped); team config + teammates are cleaned up automatically at session end.

## Step 5: Confirm

Show the complete plan to the user. State the actual write path explicitly so the user knows whether the plan landed in a feature dir or the legacy `output.plans` location:

- Feature-dir plan: `Plan written to <feature-dir>/plan.md (feature-resident; F-NNN derived from path).`
- Legacy plan: `Plan written to <output.plans>/<NNN-slug>.md (legacy; no feature dir resolved).`

Indicate next step is `/ae:work <plan file path>`.

## Output

1. Plan file (with acceptance criteria + step-AC mapping + parallel strategy)
2. Plan review summary (with architect/analyst/simplifier discussion records)
3. Doodlestein review (if cross-family available)

## Completion Invariant

**Guard**: only fire if plan `status: reviewed` (i.e., plan review passed). If plan is still `status: draft` (review found Must Fix items), skip — do not write `pipeline.plan: done` for unreviewed plans.

When guard passes, write pipeline state:

- [ ] **Freeze the GOAL**: for a feature-dir plan, write the verbatim `## Acceptance Criteria` section of this `plan.md` → `<feature-dir>/goal.frozen.md` — the immutable acceptance standard a fresh `/ae:review` re-examines the work against (frozen at plan-approval so the executor cannot move the goalposts during work). Only the GOAL is frozen (AC substance + `verify_by` + `verify:`); the harness/means stay editable in the live plan (goal/harness split deferred). Legacy plans (no feature dir) skip.
- [ ] Read plan frontmatter `discussion:` field
- [ ] If `discussion:` is non-empty → read that discussion's `index.md`:
  - Set `plan: "<path-to-this-plan-file>"`
  - Set `pipeline.plan: done`
- [ ] If `discussion:` is empty → skip silently (standalone plan, no discussion to update)

## Next Steps

Based on plan status, suggest with exact executable command:
- If plan approved → `Pipeline state updated. Next: /ae:work <plan-file-path>`
- If plan has unresolved discussion references → `Unresolved discussions. Run /ae:discuss <discussion-dir> first.`
- If plan review raised Must Fix items → `Must Fix items remain. Re-run /ae:plan-review <plan-file-path>`

## Trace emission (final step)

Before skill exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit 9-field trace record to `~/.ae/traces/<session-id>.ndjson` (no LLM content, per-skill-invocation metadata for v0.11.x consumers).
