---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
model: opus
effort: high
---

## Argument Inference

If `$ARGUMENTS` is empty, scan for the most recent plan with all steps completed (`- [x]`) and `status` not `done` across BOTH plan locations:
1. **Feature-dir plans (primary)**: `.ae/features/{active,done,abandoned}/F-*/plan.md`
2. **Legacy plans (fallback)**: `output.plans/*.md` (default `.ae/plans/`, configurable via `pipeline.yml`)
3. Apply tiebreaker rules across the union of both locations (mirrors `/ae:work` argument-inference union scan).
4. Found → use that plan file path.
5. Not found → ask user which plan to review.

Without this union scan, zero-arg `/ae:review` invocations against feature-dir plans cannot find their target.

# /ae:review — Deep Review (Feature Completion Gate)

Deep review of all changes for **$ARGUMENTS**.

## Pre-checks (all must pass before starting)

### Check 1: Agent Teams
- Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set
- If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

### Check 2: Plan All Done
- Read the plan file
- Confirm all step checkboxes are `- [x]`
- If pending → suggest `/ae:work`, **refuse to execute**

### Check 3: Tests Green
- Run the test command from pipeline.yml. If empty → skip, show "⚠️ No test command configured, skipping tests"
- If fail → fix first, **refuse to execute**

### Check 4: Deferred Findings Audit

**Milestone path resolution** (mirrors `/ae:work` Milestone path resolution helper):
- **Feature-dir plan** (path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`) → notes file = `.ae/features/<state>/F-NNN-<slug>/milestones/notes.md`. Path-derived; no plan frontmatter required.
- **Legacy plan** (under `output.plans/`) → notes file = `<output.milestones>/<plan-id>/notes.md` where `plan-id` = plan frontmatter `id:`.

Read the resolved notes.md path. If file doesn't exist or has no `DEFERRED` entries → skip: `✅ No deferred findings to audit`. Hardcoding the legacy path silently misses deferred-finding audit data for feature-dir plans.

For each `DEFERRED [Step N]:` entry, classify by reading the `Disposition:` line appended by ae:work Check 4:
- **FIXED** — entry has `Disposition: FIXED` line
- **WAIVED** — entry has `Disposition: WAIVED: <reason>` line
- **UNRESOLVED** — no `Disposition:` line present (silent drop — the original problem this feature solves)

If any UNRESOLVED entries exist → **hard block on review verdict**:
```
⚠️ UNRESOLVED deferred findings (silent drops):
- DEFERRED [Step N]: <description>

Options:
1. Fix now — address before completing review
2. Waive — accept as-is with documented reason
3. Move to backlog — BL-NNN for future resolution
```
Verdict cannot be written until all UNRESOLVED items are dispositioned.

Include audit results in review report. Add to Outcome Statistics: `Deferred resolution rate: X/Y resolved (Z waived, W to backlog)`

### Check 5: Plan's Discussion Source Valid

Read plan frontmatter `discussion:` field.

- **`discussion:` is empty** → standalone plan exemption: skip this check silently, log `[REVIEW] Plan is standalone (no discussion); primary context bundle scoped to plan + commit range only.`
- **`discussion:` is non-empty string** (treated as a directory path): verify `<discussion-dir>/conclusion.md` exists, is readable, and is non-empty (file size > 0 bytes).
  - **Exists, readable, non-empty** → pass, continue to the Per-review Primary Context Bundle assembly.
  - **Missing, unreadable, or empty (zero bytes)** → **refuse to execute**:
    ```
    Plan references discussion directory <discussion-dir> but <discussion-dir>/conclusion.md is missing/unreadable/empty.
    Either conclude the discussion (run /ae:discuss <discussion-dir>) or remove plan's 'discussion:' frontmatter field to treat this plan as standalone.
    ```
    The refusal MUST show the discussion-**directory** path (same as plan's `discussion:` field value), NOT the `conclusion.md` file path, so the suggested `/ae:discuss` fix-command is directly runnable. Empty conclusion is rejected because the Per-review Primary Context Bundle requires the "full verbatim body" as primary input; a zero-byte file would silently erase all discussion-derived constraints despite passing a file-exists check.

**Placement rationale**: Check 5 is a blocking gate that re-uses the plan file already loaded by Check 2 (Plan All Done) — adding only one frontmatter-field read plus a conclusion.md stat/read. Independent of Check 2-4 ordering: Check 2 scans step checkboxes, Check 4 parses milestone notes; neither depends on the conclusion.md file Check 5 guards. Grouping it last in the Pre-check chain keeps entry gates together and mirrors Plan 047's Pre-check Check 5 placement at the tail of `/ae:work`'s Pre-check section.

### Prior Context (from Mengdie)

Run this step after Pre-checks pass and before creating the review team.

1. Call `memory_search` MCP tool with the feature name from $ARGUMENTS or plan title as query
2. If `memory_search` is not available, fails, or returns no results — emit `Prior context: unavailable (tool not registered / no relevant results)` and continue
3. If results returned with `degraded` field non-null — annotate results as "(partial — [degraded reason])"
4. Present results under `## Prior Art from Project Knowledge Base` with provenance for each item: `title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`
5. Include prior review patterns and known issues in reviewer prompts (Step 3) as additional context — treat as background, does not constrain review

## Per-review Primary Context Bundle

Assemble the primary-context bundle **once per /ae:review invocation** (before spawning any reviewer). The bundle MUST be embedded **verbatim** in every reviewer spawn prompt — specialized Claude-native reviewers, challenger, and cross-family proxies (Codex/Gemini) alike. Path-ref handoff to proxies is deliberately rejected (Discussion 050 Round 3): silent self-read failure is an undetectable class, and verbatim-for-all eliminates it at trivial cost (median ~9KB aggregate, max ~34KB across both proxies).

**Substitution semantics**: the `<PRIMARY CONTEXT BUNDLE — ...>` angle-bracket block in section 3's spawn templates is a **substitution marker** — when TL spawns reviewers, this marker MUST be replaced with the literal assembled bundle text (file bodies inline). Summaries, descriptions, file path references, or sub-bullets that paraphrase the contents are NOT compliant — Discussion 050 Round 3's verbatim-for-all decision rejected exactly that pattern. Self-test: after spawning, the reviewer's `prompt:` field byte count MUST be ≥ the observability log's `<total>B` value (plus role-specific instructions).

This is BL-033 Layer 3 — cumulative input propagation at the work→review phase boundary.

Bundle contents:

1. **Plan AC list**: the entire `## Acceptance Criteria` (or `## AC`) section of the plan — full text, not just ACs touched by reviewed commits.
2. **Conclusion body** (when plan is discussion-referenced — see Check 5 gate): the full verbatim body of `<discussion-dir>/conclusion.md`. "Primary input" = equivalent in role to CLAUDE.md or user instructions; NOT an `@reference`, NOT a summary, NOT a "read if needed" footnote.
3. **Framing body** (optional, load-if-exists): the full body of `<discussion-dir>/framing.md` if the file exists. Silently skip if absent.
4. **Commit range descriptor**: the base→HEAD range computed per Review scope (feature branch: `main...HEAD`; main branch: `<feature-start>..HEAD`). Descriptor is the range string — NOT the full diff (reviewers run `git diff` themselves; the bundle declares the agreed-upon range).

**Standalone plan exemption**: if plan's `discussion:` is empty (re-read from plan frontmatter at bundle-assembly time — do NOT cache a boolean from Check 5; compaction between Pre-checks and bundle assembly is a small but real risk), skip items 2 and 3; bundle reduces to items 1 and 4.

**Fresh per-invocation disk read**: assemble the bundle fresh from disk at invocation start. Do NOT rely on plan body / conclusion / framing remaining in TL's context from an earlier skill (`/ae:work` just completed; TL's working context may be post-compaction).

**Context size note**: uniform verbatim-for-all across N reviewers compounds per-invocation token cost (~plan_AC + conclusion + framing) × (reviewers + challenger + enabled proxies). On constrained fallback models (Haiku) the aggregate spawn prompt may crowd reasoning budget; this is an accepted Known Limit with a reopen trigger (markedly shallower reviewer output on bundles > 10KB). If cost or quality signal fires, re-file as BL — do not solve speculatively now.

**Observability log**: at assembly time, TL emits one line: `[REVIEW] Primary context bundle assembled: <N>B (plan_AC=<a>B, conclusion=<b>B, framing=<c>B)`. Zero architecture change; creates the measurable surface the cost-signal reopen trigger needs (without it, "aggregate per-/ae:review cost spike" has no observable signal and the trigger fires invisibly).

**Interaction with `### Prior Context (from Mengdie)`**: the Prior Context step (above) separately retrieves Mengdie prior-art results and per its own spec includes them in reviewer spawn prompts "as additional context — treat as background, does not constrain review". The primary bundle and Mengdie results are BOTH inserted into each reviewer spawn prompt but at different hierarchy levels: primary bundle = primary input (same role as CLAUDE.md); Mengdie results = advisory background appended AFTER the primary bundle. Do NOT merge them into one block; do NOT drop Mengdie results when embedding the bundle.

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:review creates exactly **5 tasks** per invocation (1 Pre-check + 4 review tracks). NO additional per-phase tasks for Synthesis / Fixup / Outcome Statistics / Output / Knowledge Capture / Completion Invariant — those are sub-actions of the review cycle.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:review: Pre-check` | At skill start (before Check 1) | Immediately before Check 1 | After Check 5 passes |
| `ae:review: Security review` | At skill start (with Pre-check, even though spawn happens later — batch-create per agent-teams §C.1) | When the corresponding reviewer agent is spawned in step 3 | When the track's findings arrive at TL via SendMessage |
| `ae:review: Performance review` | (same) | (same) | (same) |
| `ae:review: Architecture review` | (same) | (same) | (same) |
| `ae:review: Cross-family challenge + synthesis` | (same) | (same) | (same) |

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Execution: Agent Teams Review

**Review scope**: determine base commit (feature branch: `git diff main...HEAD`, main branch: `git diff <feature-start>..HEAD`).

**Task lifecycle (Pre-check)**: at the very start of Pre-checks (before Check 1), `TaskCreate(subject: "ae:review: Pre-check")` and immediately `TaskUpdate(taskId, status: "in_progress")`. After Check 5 passes (control reaches Per-review Primary Context Bundle assembly), `TaskUpdate(taskId, status: "completed")`.

### 1. Create Team

```
TeamCreate(team_name: "<feature>-review")
```

### 2. Create Tasks

Batch-create the 4 review-track tasks at this point (per agent-teams §C.1 — created at skill start phase, even though their `in_progress` transition fires later when the corresponding reviewer is spawned):

```
TaskCreate(subject: "ae:review: Security review")
TaskCreate(subject: "ae:review: Performance review")
TaskCreate(subject: "ae:review: Architecture review")
TaskCreate(subject: "ae:review: Cross-family challenge + synthesis")
```

Track the 4 task IDs alongside the team handle. Do NOT create additional tasks beyond these 5 (Pre-check + 4 tracks). Synthesis, Fixup, Outcome Statistics, Output, Knowledge Capture, and Completion Invariant are sub-actions; they do NOT get their own tasks (would produce ~16-task panel noise — explicitly rejected per Plan 052).

### 3. Select and Launch Reviewers

Every reviewer spawn prompt below embeds the primary-context bundle verbatim (see "## Per-review Primary Context Bundle" above). Cross-family proxies receive the bundle text in their spawn prompt — NOT a path reference.

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. Analyze `git diff --stat` to determine which context signals match. Select 2-4 reviewers. Always include **challenger** (pure opposition).

**Cross-family**: Read `cross_family` from pipeline.yml. Follow the cross-family rules in the **Agent Selection Reference** skill — different angles per proxy. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

**Task lifecycle (per-track)**: when each reviewer agent is spawned, immediately `TaskUpdate(reviewerTaskId, status: "in_progress")` for the track that reviewer covers. Track-to-task mapping: security-reviewer → `Security review`, performance-reviewer → `Performance review`, architecture-reviewer → `Architecture review`, challenger + cross-family proxies → `Cross-family challenge + synthesis` (one shared task). Track IDs come from the Step 2 batch-create.

**Launch all in one message** (`run_in_background: true`):

```
# For each selected reviewer:
Agent(subagent_type: "<reviewer>", name: "<reviewer>",
      team_name: "<team>", run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>
               Review <diff-range> for <your domain>. Follow Team Communication Protocol.
               Teammates: [other selected reviewers], challenger.
               SendMessage findings to team-lead when done.")

# Always include challenger (pure opposition — does NOT synthesize):
Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>
               Operate in /review mode per Team Communication Protocol.
               Review scope: <diff-range>.
               Teammates: [selected reviewers], <enabled proxies>.
               Step 1: independent review of blind spots.
               Step 2: targeted challenges with structured format (Claim/Evidence/Objection/Confidence).
               SendMessage challenges to team-lead when done.
               You are pure opposition. Do NOT synthesize — TL synthesizes.")

# Cross-family — for each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
# Verbatim bundle text embedded in spawn prompt; the proxy agent's two-layer assembly
# forwards it into the MCP message field. Do NOT pass a path-ref instead of the bundle.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>
               Review <diff-range> via <proxy> MCP. <assigned angle>.
               SendMessage findings to team-lead when done.")
```

**No worktree isolation** — teammates need SendMessage communication.

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference — proxy 120s MCP timeout + 120s wait timeout.

### 4. TL Synthesizes Final Report

**Task lifecycle (per-track completion)**: when each track's findings arrive at TL via SendMessage, immediately `TaskUpdate(reviewerTaskId, status: "completed")` for that track. The 4 review-track tasks transition independently as their reviewers finish. The "Cross-family challenge + synthesis" task transitions when the last cross-family / challenger reply arrives (it's a shared task across challenger + 2 proxies).

TL collects all findings from reviewers + challenger + cross-family proxies, then synthesizes:
- Merge overlapping findings, resolve contradictions
- Produce Disagreement Value Assessment where reviewers disagreed
- Classify by severity (P1/P2/P3)

If any agent idle > 5 minutes without sending findings, SendMessage to prompt.

### 5. Close Team

After report arrives, send shutdown_request to all teammates.

## Result Processing

### Severity Levels
- **P1** — security vulnerabilities, data loss, crashes
- **P2** — performance, maintainability, architecture issues
- **P3** — minor improvements

## Fixup Flow

### 1. Build Mapping Table

```
| Finding       | Commit (step)           | Fix              |
|---------------|-------------------------|------------------|
| Missing guard | abc123 (step 2: repo)   | Add null check   |
| Unused import | def456 (step 4: screen) | Remove           |
```

Group by commit. Check for dependencies between findings.

### 2. Fixup Commits

One fixup per original commit (not per finding):

```bash
git commit --fixup=abc123
git commit --fixup=def456
```

### 3. Squash

```bash
git rebase --autosquash main
```

### 4. Verify

Re-run test command from pipeline.yml, confirm tests pass.

### 5. Remaining Findings Disposition

P2/P3 per standard rule (fix / defer / backlog).

### Fixup Loop Limit

Track consecutive fixup rounds. Read `work.max_fix_loops` from pipeline.yml (default: 3). If the same finding persists after that many fixup rounds:

```
🔴 Fixup loop limit reached: 3 rounds of fixup without resolution.

Options:
1. Fix manually — pause for human intervention
2. Defer to backlog — write to `output.backlog/unscheduled/` as BL-NNN-slug.md (new BLs always land unscheduled; user commits to a sprint later via `/ae:roadmap plan`)
3. Accept as-is — record finding as known issue in review report
```

Do NOT continue fixup indefinitely.

## Outcome Statistics

After all fixups are done, compile outcome data for this feature cycle:

```
## Outcome Statistics
- Steps completed: N/M
- Rework rate: X steps needed fixup commits (X/N = Y%)
- P1 escape rate: Z P1 findings discovered in /ae:review (should be 0 if /ae:work pre-commit caught them all)
- Drift events: D contract violations during /ae:work (approved: A, fixed: F, rolled back: R, unknown: U)
- Fix loop triggers: N circuit breaker activations during /ae:work (same test file failed max_fix_loops times)
- Auto-pass rate: P steps auto-continued / N total steps (only if auto_pass was enabled)
```

Include this in the review report. This data accumulates naturally across features, providing evidence for tuning checklists and gate conditions over time.

## Output

**Write target rule** (mirrors plan/SKILL.md Step 2 path-derive convention):

- **Feature-dir plan** (target plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`) → write `review.md` next to the plan at `.ae/features/<state>/F-NNN-<slug>/review.md`. Path-derived; no frontmatter required to make this decision.
- **Legacy plan** (under `output.plans/`) → write to `pipeline.yml` → `output.reviews/NNN-...md` per the existing convention.

**No surface-index pointer file is written.** Discoverability for `/ae:dashboard` and `/ae:next` is preserved via union scan over both `output.reviews/*.md` and `.ae/features/{active,done}/F-*/review.md` — see those skills' Reviews scanning rule. This eliminates dual-write debt; readers, not writers, bridge the two locations.

Review file frontmatter must include:

```yaml
---
id: "NNN"                  # legacy fallback only; feature-dir reviews MAY omit (path is canonical)
title: "Review: <feature>"
type: review
created: YYYY-MM-DD
target: "<path-to-plan-file>"
verdict: pass    # or: fail
---
```

The `verdict` field is required — it enables `/ae:dashboard` and `/ae:next` to determine review completion without reading file content.

Report contents:
1. TL synthesis report (merged findings from all reviewers + challenger + cross-family, with Disagreement Value Assessment and severity classification)
2. Outcome statistics (rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate)
3. Fixups squashed
4. Deferred findings audit results (FIXED/WAIVED/UNRESOLVED classification from Check 4), backlog items to `pipeline.yml` → `output.backlog/unscheduled/` (default: `docs/backlog/unscheduled/`) — sprint assignment via `/ae:roadmap plan` later
5. Prompt user to create PR

### Knowledge Capture (to Mengdie)

Run this step after the review report is written and before prompting for PR creation.

Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) for common rules (max 3 items, atomic units, graceful degradation, conflict handling).

**Skill-specific extraction**:
- One item per reusable pattern (P2+ findings that apply beyond this specific code)
- Skip one-off bugs that are already fixed in the fixup commits
- `source_type`: `review`
- `knowledge_type`: `experiential`
- `entities`: derive from each specific pattern, NOT from the broad review title. Use compound tags specific to the pattern (e.g., `sqlite-migration-column-guard`, `mcp-project-scope-validation`). Avoid single broad tags.
- `source_file`: path to the generated review file

**Closing output** — report what was ingested and any conflicts:
- `Knowledge capture: [N] items ingested, no conflicts`
- Or: `Knowledge capture: [N] items ingested, conflicts detected with: [titles]`

## Completion Invariant

After writing the review file with `verdict:`, update pipeline state:

- [ ] Update plan frontmatter: `status: done` (if not already set by self-healing)
- [ ] Log: `[WRITEBACK] Review written, plan status confirmed done`

### Feature-level archive trigger (GTD)

When `verdict: pass` AND the target plan's feature dir is in `.ae/features/active/F-NNN-slug/`, archive the feature.

**Plan 051 path-derived archive trigger**: as of Plan 051, feature-dir plans live at `.ae/features/<state>/F-NNN-<slug>/plan.md`. The archive trigger derives the feature dir directly from the plan path — no frontmatter required, no scan, no ambiguous-match flow. Legacy plans (under `output.plans/`) retain a single explicit-fallback path emitting the manual-archive message.

#### Phase 1 — Locate the feature dir

Try in order. The first match resolves; on no match emit the manual-archive message and STOP (do not proceed to Phase 2).

1. **Feature-dir plan path** (Plan 051+): if the target plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`, the feature dir IS the plan's parent directory. Path-derived; resolves directly. No frontmatter or scan needed.
2. **Legacy plan with `feature: F-NNN` frontmatter**: optional bridge for legacy plans that explicitly tag a feature dir → resolves directly via that field.
3. **No match** (legacy plan with no `feature:` field; or path matching neither shape) → list `ls .ae/features/active/` and embed the actual paths in the message (do NOT print the literal placeholder `F-NNN-<slug>` — substitute the candidate dirs):
   ```
   📦 Manual archive required:
      Plan <plan-path> verdict pass, but no feature dir linkage found
      (legacy plan without feature: frontmatter).

      Candidates currently in .ae/features/active/:
        - .ae/features/active/F-027-some-slug/
        - .ae/features/active/F-031-other-slug/
        - .ae/features/active/F-042-third-slug/
      (or "(none — features/active/ is empty)" if the dir is empty)

      If one of the above is the feature this plan completed, run:
        mv .ae/features/active/<chosen-feature-dir>/ .ae/features/done/<same-feature-dir>/
      and edit index.md inside that dir to set:
        status: done
        done: <today YYYY-MM-DD>

      Skipping automatic archive (proceed manually using the list above).
   ```
   Log: `[ARCHIVE] Manual fallback: no feature linkage; user-action recommended (N candidates listed).`
   STOP — do not run Phase 2.

#### Phase 2 — Execute archive (only when Phase 1 resolved a single feature dir)

1. **Move the feature dir**: `mv .ae/features/active/F-NNN-<slug>/ .ae/features/done/F-NNN-<slug>/`. Plain `mv` — `.ae/` is gitignored. Atomic on the same filesystem.

2. **Update the feature `index.md` frontmatter** in place:
   ```yaml
   status: done       # was: active
   done: YYYY-MM-DD   # today
   ```
   Preserve all other fields. Do NOT remove `origin_bl:` or any optional field — they remain part of the audit trail.

3. **Update roadmap file (if linked).** If the feature's `index.md` has a non-empty `roadmap:` field, locate `.ae/roadmaps/active/<roadmap-name>.md`. If the roadmap file has a body table or list referencing this feature with a status column, update that row (best-effort; don't fail the archive on roadmap edit failure). Log either `[ARCHIVE] Updated roadmap <name>.md feature entry to done` or `[ARCHIVE] Roadmap <name>.md has no parsable feature row; skipped roadmap update`.

4. **Log success**: `[ARCHIVE] Feature F-NNN-<slug> moved to features/done/.`

When `verdict: fail` → **do NOT mv**. The feature stays in `features/active/`. The user may, after fixup, re-run `/ae:work` and `/ae:review` for another verdict, OR manually `mv .ae/features/active/F-NNN-<slug>/ .ae/features/abandoned/F-NNN-<slug>/` if the feature is being dropped.

### Legacy artifact preservation — Plan 050 / Plan 051 known limit

Plan 051's path migration moves NEW work into feature dirs but deliberately leaves the 175 pre-existing legacy artifacts in `.ae/discussions/`, `.ae/plans/`, `.ae/reviews/` untouched (Plan 050 known limit: "既有 175 legacy artifact 不迁 = 自然终态消亡"). The audit chain is therefore split based on each artifact's birth date:

- **Post-Plan-051 features**: `features/{active,done,abandoned}/F-NNN-<slug>/` contains origin-BL + feature frontmatter + analysis + plan.md + review.md + discussions/.
- **Pre-Plan-051 features**: feature dir contains origin-BL + index + analysis only; plan + review files remain in legacy `.ae/plans/`, `.ae/reviews/` (linked via discussion id chain or optional `feature: F-NNN` frontmatter on legacy plans).

The archive trigger **does not** attempt to collect or symlink legacy plan/review files into the feature dir for pre-Plan-051 features. Cross-references work via frontmatter `id:` (feature/plan/review IDs are stable across mv — directory location is not load-bearing for lookup). Run `/ae:roadmap` or `/ae:dashboard` to verify the feature shows up in `done/` and the linkage chain still resolves across both locations (dashboard/next union-scan both legacy and feature-dir reviews per Plan 051 Step 5).

### Cross-references survive the mv

AE internal cross-references use frontmatter `id:` not path strings. `mv` of the feature dir does not break:

- `BL-NNN.md` `promoted_to: F-NNN` → still resolves (grep for `id: F-NNN` across `features/{active,done,abandoned}/`).
- Plan/review path-derived feature ID (Plan 051+): when plan.md / review.md live inside the feature dir, the dir IS the feature ID — no frontmatter required, no scan, archive trigger Phase 1 step 1 resolves directly.
- Optional `feature: F-NNN` frontmatter (legacy bridge): readers validate against parent dir path and warn on mismatch; path always wins.
- `ae:roadmap` section (a) `origin_bl:` dedup → already scans active+done+abandoned per Step 4 fix.
- `ae:roadmap` section (d) archive prompt → recognizes a fully-done roadmap when all linked features are in `done/` (or `done/`+`abandoned/`).

### Recovery — undoing an archive

Archive is `mv .ae/features/active/F-NNN-<slug>/ .ae/features/done/F-NNN-<slug>/` plus an in-place `index.md` frontmatter edit. To undo (e.g., the user got a `verdict: pass` they later disagree with):

1. `mv .ae/features/done/F-NNN-<slug>/ .ae/features/active/F-NNN-<slug>/`.
2. Edit the moved `index.md` frontmatter: revert `status: done` → `status: active`, remove the `done:` field.
3. (Optional) If the archive trigger updated a roadmap row to `done`, edit that row back to its prior state (or run `/ae:roadmap` to see the corrected state and re-match by hand).

Plan/review files in legacy paths are unaffected by archive (they were never moved by the trigger). The review file's `verdict:` field stays as written; if the user wants to rebut, they edit the review file's frontmatter or write a new review pointing at the same plan.

Recovery is a manual flow — automation would require persistent archive-history beyond Plan 050's scope.

## Next Steps

Based on review outcome, suggest with exact executable command:
- If review passed → `Review passed.` Suggest next action based on project's source control workflow and context. Let user decide.
- If review has P1 findings → `P1 findings remain. Fix and re-run /ae:review <plan-file-path>`
- If review deferred items → `Deferred items exist. Address in next iteration or /ae:plan for follow-up.`
