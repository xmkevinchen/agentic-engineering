---
name: ae:plan-review
description: Re-review an existing plan with Agent Teams (standalone plan review without regenerating)
argument-hint: "<plan file path>"
user-invocable: true
effort: medium
---

## Argument Inference

If `$ARGUMENTS` is empty, scan for the most recent plan with `status: draft` or `status: reviewed` across BOTH plan locations:
1. **Feature-dir plans (primary)**: `.ae/features/{active,done,abandoned,paused}/F-*/plan.md`
2. **Legacy plans (fallback)**: `output.plans/*.md` (default `.ae/plans/`, configurable via `pipeline.yml`)
3. Apply tiebreaker rules across the union of both locations (mirrors `/ae:work` and `/ae:review` argument-inference union scan).
4. Found → use that plan file path.
5. Not found → ask user which plan to review.

# /ae:plan-review — Plan Review

Review the plan at **$ARGUMENTS** using Agent Teams.

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:plan-review creates 4 tasks per invocation.

| Phase | Subject | Created at | `in_progress` | `completed` |
|---|---|---|---|---|
| Pre-check | `ae:plan-review: Pre-check` | Skill start | Before pre-check 1 | After pre-check 5 passes |
| Step 1 Review | `ae:plan-review: Architect review` | Skill start (batch) | When architect agent spawned | When architect findings arrive at TL |
| Step 1 Analyst | `ae:plan-review: Dependency analysis` | Skill start (batch) | When dependency-analyst spawned | When analyst findings arrive at TL |
| Step 1 Cross-family | `ae:plan-review: Cross-family review` | Skill start (batch) | When first cross-family proxy spawned | When all cross-family findings collected |

At skill start, batch-create:

```
TaskCreate(subject: "ae:plan-review: Pre-check")
TaskCreate(subject: "ae:plan-review: Architect review")
TaskCreate(subject: "ae:plan-review: Dependency analysis")
TaskCreate(subject: "ae:plan-review: Cross-family review")
```

Owner field: omit. On error: stay `in_progress`. Step 2 (Merge Results) and Step 3 (Apply and Confirm) are sub-actions — no separate tasks.

## Pre-check

1. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled. Plan stays `status: draft`. Re-run under Agent Teams to promote to reviewed. See docs/agent-teams-policy.md.` and proceed with TL executing directly (no team spawn). The Apply and Confirm step below detects this fallback path and preserves `status: draft` (does NOT promote to `status: reviewed`).
2. Confirm `.claude/pipeline.yml` exists
3. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
4. Read the plan file at `$ARGUMENTS` — confirm it exists and contains `## Steps` and `## Acceptance Criteria`
5. If missing → **refuse to execute**: "Plan file not found. Use `/ae:plan <feature>` to create one."

## Step 1: Agent Teams Plan Review

Read the full plan text, then create a Team for parallel review.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

### Reviewer slots — built-in default + project-agent override

`plan-review` hardcodes two built-in reviewer slots. `project_agents[]` entries override only when both `role` and `specialty` match:

| Slot | Built-in default | `project_agents[]` override condition |
|---|---|---|
| plan structure reviewer | `architect` (plugin built-in: `plugins/ae/agents/workflow/architect.md`) | `role: reviewer` + `specialty` matches one of `plan-structure`, `architecture`, `design` → use the project agent instead |
| parallel / dependency reviewer | `dependency-analyst` (plugin built-in: `plugins/ae/agents/research/dependency-analyst.md`) | `role: reviewer` + `specialty` matches one of `dependencies`, `parallel-analysis` → use the project agent instead |

Built-in `architect` and `dependency-analyst` are plugin first-class reviewer slots, NOT ad-hoc roles routed by frontmatter `role:` (see [Agent Contract — Plugin built-in first-class reviewer slots](../setup/agent-contract.md#plugin-built-in-first-class-reviewer-slots)). They are hardcoded by name in this skill. The override table above is the **only** mechanism by which a `project_agents[]` entry can take a slot from a built-in here; no implicit override by mere `role: reviewer` presence. (`qa` is hard-spawned by `work/SKILL.md`, not by this skill; per agent-contract it is currently a "hardcoded transitional slot" without an override table — see the agent-contract link above for the asymmetry note.)

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family (codex/gemini), include its proxy agent in the team. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback.

```
TeamCreate(team_name: "<feature>-plan-review")

# Architect reviews plan structure and dependencies:
Agent(subagent_type: "architect", name: "architect",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: architect
                  Role: plan reviewer (decomposition + dependencies)
                  Angle: step dependency graph + parallel strategy
                  Why: mandatory baseline per plan-review selection table

               Review this plan's step decomposition and dependencies: <plan full text>.
               Follow Team Communication Protocol.
               Teammates: dependency-analyst, <enabled proxies>.
               Produce step dependency graph and parallel strategy.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "dependency-analyst", name: "dependency-analyst",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: dependency-analyst
                  Role: parallel feasibility validator
                  Angle: file domain overlap + hidden runtime deps + shared types
                  Why: stress-test architect's parallel claims via grep evidence (not assumption)

               Validate the architect's parallel assumptions in the step decomposition.
               Follow Team Communication Protocol.
               Teammates: architect.
               Wait for architect's proposal before analyzing.
               SendMessage findings to team-lead when done.")

# For each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family plan reviewer (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; complements architect + dep-analyst

               Review this plan via <proxy> MCP — <assigned angle>: <plan full text>.
               Teammates: architect, dependency-analyst.
               SendMessage findings to team-lead when done.")
```

**TL Orchestration — dependency graph**:
- architect → dependency-analyst: When architect reports findings, TL forwards to dependency-analyst (who waits for architect's proposal before analyzing)

## Step 2: TL Merges Results

TL collects findings from architect, dependency-analyst, and cross-family proxies, then synthesizes.

**Harness soundness check (F-041 — mandatory before synthesis)**: verify the plan's verification harness is present and sound:
- Every AC declares `verify_by` (`unit`/`integration`/`e2e`/`contract`/`judge`/`manual`). **Discriminator (matches `/ae:review` Check 7)**: if SOME ACs declare `verify_by` but others don't → the missing ones are **Must fix**; if NO AC declares `verify_by` → **distinguish by PATH, not date** (codex P1): a **feature-dir plan** (`.ae/features/.../F-NNN/plan.md`, post-F-041 by construction) with zero `verify_by` is **Must fix** (forgotten harness, NOT legacy — a freshly generated F-041 plan that dropped every field must not pass); only a **legacy-path plan** (`output.plans/`) with zero `verify_by` is treated as a pre-F-041 legacy plan and skipped (migrate on touch). Use field presence + plan path, never a date.
- Every `judge`-typed AC states a pass-criterion/rubric question in its body. A bare `verify_by: judge` with no rubric → **Must fix** (vibes-as-enforcement, not a harness).
- Every `contract`-typed AC names a `spec:` field pointing to a jq-assertion spec file. A `verify_by: contract` with no `spec:` → **Must fix** (a contract AC with no spec is unrunnable — codex M3, else it passes plan-review silently and the gap surfaces only at /ae:work).
- `verify_by` matches the AC kind per the claim→track mapping (Reference Case → deterministic; Output Verification → `judge`; Sanity Check → author picks). Mismatch → **Consider**.

- **Must fix** — design flaws, hidden dependencies
- **Consider** — simplification suggestions
- **Approved**

Close the Team.

## Step 3: Apply and Confirm

The promotion of plan frontmatter from `status: draft` to `status: reviewed` is **mode-gated**. The mode is determined by whether the Pre-check 1 Agent Teams gate auto-fallbacked or proceeded normally.

**[Agent Teams mode]** — Pre-check 1 found the env var set and Step 1 ran the actual plan-review team:

If there are "Must fix" items:
1. Show findings to user
2. Directly modify plan file to address findings (consistent with ae:plan's inline review behavior)
3. Update plan frontmatter `status: reviewed`

If approved with no must-fix:
1. Update plan frontmatter `status: reviewed`
2. Show review summary

**[solo fallback mode]** — Pre-check 1 auto-fallbacked due to env var unset, Step 1 ran solo (TL inline review only):

1. Show findings to user (best-effort solo review; no cross-family, no parallel reviewer perspectives)
2. Directly modify plan file to address findings if any
3. **Plan frontmatter preserves `status: draft`** — do NOT promote to `status: reviewed`. Print: "Plan reviewed in solo mode; status remains `draft` per docs/agent-teams-policy.md. Re-run under Agent Teams to promote." (Per F-027 Cliff 1+3 fix: solo plan-review is best-effort feedback, not gate-clearing. `/ae:work` Pre-check 1 will refuse a `status: draft` plan unless the user accepts the gate's load-bearing semantics by enabling Agent Teams.)
4. Show review summary

Show the plan to the user. Indicate next step is `/ae:work <plan file path>` (Agent Teams mode) or "Enable Agent Teams (2-line settings.json edit) and re-run `/ae:plan-review <plan file path>` to promote draft → reviewed" (solo fallback mode).

## Output

1. Plan review summary (with architect/analyst discussion records)
2. Updated plan file (if fixes applied)

## Next Steps

Based on review outcome, suggest:
- If plan approved → "Ready for `/ae:work <plan-file>` to execute implementation"
- If Must Fix items remain → "Address findings and re-run `/ae:plan-review`"
- If plan needs fundamental rethinking → "Consider `/ae:discuss` to revisit design decisions"
