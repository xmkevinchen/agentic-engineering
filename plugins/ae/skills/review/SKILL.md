---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
model: opus
effort: high
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.plans` for the most recent plan with all steps completed (`- [x]`) and `status` not `done`
2. Found → use that plan file path
3. Not found → ask user which plan to review

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
Read `<output.milestones>/<plan-id>/notes.md` (plan-id = plan frontmatter `id:`, already loaded at Check 2). If file doesn't exist or has no `DEFERRED` entries → skip: `✅ No deferred findings to audit`

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

## Execution: Agent Teams Review

**Review scope**: determine base commit (feature branch: `git diff main...HEAD`, main branch: `git diff <feature-start>..HEAD`).

### 1. Create Team

```
TeamCreate(team_name: "<feature>-review")
```

### 2. Create Tasks

```
TaskCreate("Security review")
TaskCreate("Performance review")
TaskCreate("Architecture review")
TaskCreate("Cross-family challenge + synthesis")
```

### 3. Select and Launch Reviewers

Every reviewer spawn prompt below embeds the primary-context bundle verbatim (see "## Per-review Primary Context Bundle" above). Cross-family proxies receive the bundle text in their spawn prompt — NOT a path reference.

**Select reviewers**: Refer to the **Agent Selection Reference** skill for the selection table. Analyze `git diff --stat` to determine which context signals match. Select 2-4 reviewers. Always include **challenger** (pure opposition).

**Cross-family**: Read `cross_family` from pipeline.yml. Follow the cross-family rules in the **Agent Selection Reference** skill — different angles per proxy. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

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

Write the review report to `pipeline.yml` → `output.reviews`. Review file frontmatter must include:

```yaml
---
id: "NNN"
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

## Next Steps

Based on review outcome, suggest with exact executable command:
- If review passed → `Review passed.` Suggest next action based on project's source control workflow and context. Let user decide.
- If review has P1 findings → `P1 findings remain. Fix and re-run /ae:review <plan-file-path>`
- If review deferred items → `Deferred items exist. Address in next iteration or /ae:plan for follow-up.`
