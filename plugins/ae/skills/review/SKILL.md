---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
model: opus
effort: high
---

<!-- ae-output-standards-v1 -->
**AE Output Standards (Summary)**:
- First line = core point (clear at a glance)
- Phase summary segmented by `---`, self-contained 90%+
- Docs: pyramid tip ≤ 5 lines, details archived
- Closed loop: user can judge 90%+ without opening docs

See [AE Output Standards](../../output-standards.md) for full reference.
<!-- /ae-output-standards-v1 -->

## Argument Inference

### Pre-step: $ARGUMENTS tokenization (HARD requirement, MUST run first)

Before form classification, TL MUST split `$ARGUMENTS` into a `<target>` slot and a list of `--reviewer <name>` flag pairs:

1. Scan `$ARGUMENTS` left-to-right; collect every `--reviewer <name>` token pair into a flag list (each `--reviewer` MUST be immediately followed by exactly one whitespace-separated value; no `=` form supported).
2. The remaining tokens (everything that is NOT `--reviewer` or its value) form the **target string**. Concatenate by whitespace if multiple non-flag tokens (rare; surface as a parse error if more than one — see grammar below).
3. **Grammar (positional)**: when `<target>` is provided, it MUST appear as a single whitespace-delimited token before any `--reviewer` flag pairs. Order rule (regex form): `(<target>)? (--reviewer <name>)*` — target optional, flags zero-or-more, target FIRST when present.
4. **Empty-target with flags is VALID**: `/ae:review --reviewer challenger` (no positional target, flag-only) is supported — resolves `<target>` = empty (Form 3 plan auto-scan), flag list = [challenger]. This is the natural "quick re-review with single reviewer angle" path. **Reject** rule "flag before target" applies ONLY when at least one positional non-flag token exists AFTER a flag (e.g., `--reviewer X foo.md` is rejected; `--reviewer X` alone is accepted).
5. **`--reviewer` value validation**: each `--reviewer` MUST be followed by exactly one value; duplicate `--reviewer X --reviewer X` rejected with hint to dedupe.
6. **Reject** if grammar violated:
   - Multiple non-flag tokens (e.g., `/ae:review foo.md bar.md --reviewer X` — surplus target token `bar.md`)
   - Flag before target with target present (e.g., `/ae:review --reviewer X .ae/foo.md`) — note flag-only with no target is VALID (rule 4 above)
   - `--reviewer` with no value (trailing flag) OR with value starting with `--` (likely missed value)
   - `--reviewer=name` (= form not supported)
   - Duplicate `--reviewer` value (same agent name twice)
   
   Refusal text:
   ```
   Argument grammar: /ae:review [<target>] [--reviewer <name>]*
     <target> must be the FIRST positional token; --reviewer flags follow.
     One <target> only (or empty for auto-resolve).
   Got: '<raw $ARGUMENTS>'
   ```

5. **All subsequent steps** in this section operate on the resolved **`<target>`** string, NOT the raw `$ARGUMENTS`. The Form 1/2/3 classification, the file-existence test (`test -f '<target>' || test -d '<target>'`), and observability trace all use `<target>` post-tokenization.

This pre-step is mandatory because raw `$ARGUMENTS` may contain interleaved flag tokens (`<plan-path> --reviewer challenger`) that would cause `test -f` against the full string to fail trivially and misroute to Form 3.

Resolve `<target>` (post-tokenization) into target type. Three forms (priority order — file-existence wins over pattern match):

### Form 1 — Local file or directory path

If `$ARGUMENTS` is a path that exists in the working tree (file or directory), treat as file/dir snapshot review target. Wins over Form 2 even if string also matches commit SHA pattern (avoids hex-filename collision).

### Form 2 — Commit reference / range

If `<target>` matches:
- Contains `..` → commit range (e.g., `HEAD~3..HEAD`, `main..HEAD`, `<sha>..<sha>`)
- `^[a-f0-9]{7,40}$` → single commit SHA → resolves to single-commit range `<sha>~1..<sha>`
- `^HEAD~?[0-9]*$` → relative commit reference → single-commit range `<ref>~1..<ref>`

Treat as commit-range review target. **Diff scope binding**: when reviewer agents need a diff, TL passes `git diff <target>` as the diff command (where `<target>` is the post-resolution range string). For single SHA / relative ref, TL resolves to the explicit range form first (`<sha>~1..<sha>`) before substituting into the diff command. This is the ad-hoc analogue to pipeline mode's "Review scope" base-commit derivation; the ad-hoc target string IS the range.

### Form 3 — Empty OR non-matching free-text (pipeline mode default)

`$ARGUMENTS` is empty OR is free-text that matches none of Form 1/2 (not a valid path, not a commit ref pattern):

- **Empty** → existing behavior: scan for the most recent plan with all steps completed (`- [x]`) and `status` not `done` across BOTH plan locations:
  1. **Feature-dir plans (primary)**: `.ae/features/{active,done,abandoned}/F-*/plan.md`
  2. **Legacy plans (fallback)**: `output.plans/*.md` (default `.ae/plans/`, configurable via `pipeline.yml`)
  3. Apply tiebreaker rules across the union of both locations (mirrors `/ae:work` argument-inference union scan).
  4. Found → use that plan file path.
  5. Not found → ask user which plan to review.
- **Non-matching free-text** → also fall to pipeline mode; if free-text doesn't resolve to a plan via inference, refuse with usage hint:
  ```
  Unrecognized argument format: '<arg>'.
  Valid forms:
    - file/dir path (existing in working tree)
    - commit ref/range (HEAD~N, sha..sha, single SHA)
    - empty (auto-resolve plan via scan)
    - plan path (feature-dir or legacy)
  See SKILL.md Argument Inference for examples.
  ```

Without this union scan, zero-arg `/ae:review` invocations against feature-dir plans cannot find their target.

### Form ambiguity resolution

**TL execution discipline (HARD requirement, not soft hint)**: when resolving `<target>` (post-tokenization), TL MUST first run `test -f '<target>' || test -d '<target>'` via Bash to verify local file/dir existence before falling through to Form 2 pattern matching.

This is **structurally enforced**, not advisory:

- SKILL.md instruction is imperative (`MUST first run`), not suggestive
- "MUST" in LLM prompts is soft constraint — TL might skip Bash and pure-string pattern match. Mitigation: TL MUST emit TWO observability trace lines:
  - **Pre-trace** (after tokenization, before file-existence Bash test):
    ```
    [AE-REVIEW] Args tokenized: target=<target>, reviewers=[<flag-list>]
    ```
  - **Post-trace** (after Bash test + form classification, before Pre-checks router):
    ```
    [AE-REVIEW] Argument inference: target=<target>, file_check=<true|false>, form=<1|2|3>
    ```
  If post-trace absent in audit log → TL skipped Bash. This makes the failure mode visible. The two-trace split avoids the contradiction of "emit before classification but include classification result" — pre-trace shows tokenization landed; post-trace shows classification completed.
- Pure string-pattern dispatch in LLM context is non-deterministic — could mismatch e.g., a file named `abc1234` (valid hex SHA pattern) as commit ref instead of file → silent wrong-target review.

**Resolution order**:
1. **Tokenization first** — split raw `$ARGUMENTS` per Pre-step above; obtain `<target>` + flag list. Reject on grammar violation.
2. File-existence check on `<target>` (Form 1) — local files take precedence over commit SHA matching.
3. If `<target>` is plan path (Form 1 file exists AND path matches `.ae/features/<state>/F-NNN-<slug>/plan.md` OR `output.plans/NNN-*.md`) → enter pipeline mode (existing behavior); pipeline pre-checks apply UNLESS `--reviewer` flag was set, in which case Pre-checks router treats as pipeline (full 5 checks fire) but Output rule applies case (c) — see Output section.
4. Otherwise (file but not plan / dir / commit ref / empty / non-matching free-text) → ad-hoc OR pipeline per type.

### Filename timestamp normalization (filesystem-safe + collision-free)

For ad-hoc review filenames (`output.reviews/adhoc/<id>-<timestamp>.md`), use **`YYYYMMDDTHHMMSSsssZ`** (UTC, millisecond precision, no colons, no dashes inside the time portion — fully filesystem-safe across POSIX + Windows). This matches Track 4 staging file convention (`<output.reviews>/per-commit/.staging-<plan>-step-<N>.md` uses same format on manual-mode). Millisecond precision prevents sub-second filename collisions on rapid back-to-back invocations.

**`created:` frontmatter field** MUST use the same format (`YYYYMMDDTHHMMSSsssZ`) — single canonical timestamp form across both filename and frontmatter. This eliminates the dashboard-tiebreaker ordering bug that mixed-form timestamps would produce.

# /ae:review — Deep Review (Feature Completion Gate)

Deep review of all changes for **$ARGUMENTS**.

## Pre-checks

**Target-mode router** (applies before Check 1):

The router has **two orthogonal axes**: target form (1/2/3) AND `--reviewer` flag presence. Resulting matrix:

| Form | `--reviewer` flag | Pre-check mode | Output mode |
|---|---|---|---|
| 3 (empty) OR 1 (plan path) | absent | **Full pipeline** (all 5 checks) | Case (a) feature-dir / Case (b) legacy |
| 3 (empty) OR 1 (plan path) | present | **Reduced pipeline** (Check 1 only — see below) | Case (c) ad-hoc/<id>-rerun-<reviewers>.md |
| 1 (non-plan file/dir) OR 2 (commit ref/range) | absent | **Ad-hoc** (Check 1 only) | Case (c) ad-hoc/<id>.md |
| 1 (non-plan file/dir) OR 2 (commit ref/range) | present | **Ad-hoc** (Check 1 only) | Case (c) ad-hoc/<id>-rerun-<reviewers>.md |

**`--reviewer` flag with plan target — Reduced pipeline rationale**: when user passes `--reviewer challenger` against a plan path (re-review with override angle), they want a focused single-angle pass on existing work. Re-running Check 2 (Plan All Done — already verified by prior review), Check 3 (Tests Green), Check 4 (Deferred audit — already done), Check 5 (Discussion source) would block re-review on plans where state has shifted (e.g., new commits added). The flag presence is an explicit "I know what I'm doing, just run the override reviewers" signal. Reduce pipeline pre-checks to Check 1 (Agent Teams gate — always required) only.

Ad-hoc mode reasoning: target is not a pipeline plan OR user signaled re-review intent; pipeline-state validations don't apply. Agent Teams gate still required (review needs agent infrastructure).

## Pre-checks (all must pass before starting; pipeline mode only — see router above)

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

**Before `TeamCreate`** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

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

### `--reviewer <name>` flag (override default selection)

`$ARGUMENTS` may include one or more `--reviewer <name>` flags. Each flag occurrence specifies one reviewer to spawn. Examples:

- `/ae:review HEAD~3..HEAD --reviewer challenger` → spawn ONLY challenger
- `/ae:review HEAD~3..HEAD --reviewer codex-proxy --reviewer gemini-proxy` → spawn ONLY both proxies
- `/ae:review HEAD~3..HEAD` (no flag) → existing default selection table (current behavior)

**Override semantics (NOT additive)**: when one or more `--reviewer` flags present, **skip the default Agent Selection Reference table entirely**. Spawn ONLY the listed agents. This is intentional override — the use case is "I want exactly these reviewers, not the default mix" (D3 re-review with specific angle).

Concrete examples to prevent ambiguity:

- **WRONG behavior** (additive interpretation): `/ae:review HEAD --reviewer security-reviewer --reviewer challenger` → runs security + challenger PLUS default selection table reviewers (architecture / cross-family / etc).
- **CORRECT behavior** (override per F-012): `/ae:review HEAD --reviewer security-reviewer --reviewer challenger` → runs ONLY security + challenger; default selection table SKIPPED entirely.

**Multi-flag is additive AMONG flags, but collectively override default**: `--reviewer X --reviewer Y` spawns both X and Y (additive to each other), but skips the default selection table entirely (collective override). Listing 5 `--reviewer` flags spawns 5 reviewers, all together, no defaults added.

**Scale anchor — what "skip default table" actually means** (silent quality degradation risk if user thinks adding to default):

Default selection table per `ae:agent-selection` SKILL.md typically spawns **4-5 reviewers** (e.g., 1-2 core reviewers + challenger + 2 cross-family proxies). Using `--reviewer challenger` alone means:

- Spawned: 1 (just challenger)
- **Skipped**: 3-4 reviewers (architecture-reviewer / security-reviewer / codex-proxy / gemini-proxy depending on diff signals)

Using `--reviewer` is a **deliberate scope reduction**, not an addition. If user wants challenger PLUS the default mix, they need to either (a) not pass `--reviewer` flag (default mix runs), or (b) explicitly list every reviewer they want in `--reviewer` flags.

**Future additive variant** (forward-reference): if `--reviewer` override proves insufficient (likely 60%+ within 6 months per regret analysis), v0.11.x may add `--add-reviewer <name>` flag (additive to default table, POSIX-style two-flag split — keep `--reviewer` as override, `--add-reviewer` as additive). F-012 deliberately defers this to keep scope minimal.

**Invalid name handling**: each `--reviewer <name>` value MUST be a valid agent name (e.g., `challenger`, `codex-proxy`, `architecture-reviewer`, `ae:engineering:minimal-change-engineer`). Unknown name → **hard fail** with full list of valid names. Do NOT silently skip unknown names (would silently shrink review coverage).

**Combined with target**: `--reviewer` flag is fully orthogonal to `<target>` argument; both can be specified. Example: `/ae:review src/foo.py --reviewer security-reviewer` → review file with only security-reviewer.

**Not on ae:code-review**: this flag is ae:review only. ae:code-review's 4-track structure is fundamentally multi-reviewer; single-reviewer use cases route through ae:review with `--reviewer`.

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

**Write target rule** (mirrors plan/SKILL.md Step 2 path-derive convention; 3 cases — pipeline + ad-hoc):

- **(a) Feature-dir plan** (target plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`, AND no prior `review.md` at same dir, AND no `--reviewer` flag) → write `review.md` next to the plan at `.ae/features/<state>/F-NNN-<slug>/review.md`. Path-derived; no frontmatter required to make this decision.
- **(b) Legacy plan** (target under `output.plans/`, AND no prior matching review at `output.reviews/`, AND no `--reviewer` flag) → write to `pipeline.yml` → `output.reviews/NNN-...md` per the existing convention.
- **(c) Ad-hoc target OR re-review OR `--reviewer` flag present** → write to `pipeline.yml` → `output.reviews/adhoc/<id>-<timestamp>.md`. Timestamp uses millisecond precision UTC: `YYYYMMDDTHHMMSSsssZ` (no colons, no dashes inside time portion — matches Track 4 staging file convention; prevents sub-second collisions on rapid back-to-back invocations). `<id>` derivation (rules apply in order; **first match wins** — more specific rules listed first):
  1. **`--reviewer` flag with plan target** (plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md` OR `output.plans/NNN-*.md`): feature ID (or legacy plan ID) + `-rerun-<reviewer-name-list>` (multi-flag → join names with `-` after dedup; e.g., `F-012-rerun-challenger-codex-proxy`).
  2. **`--reviewer` flag with non-plan target** (file/dir/commit ref/range — feature-id is undefined): target slug from rule 3 + `-rerun-<reviewer-name-list>` (e.g., `src-foo-py-rerun-challenger`; `HEAD-3-HEAD-rerun-security-reviewer`). Rule 2 covers the gap where flag is set but target has no derivable feature-id.
  3. **Re-review on plan (no `--reviewer` flag, prior `review.md` exists)**: feature ID (or legacy plan ID) + `-rerun` suffix (e.g., `F-012-rerun`).
  4. **Ad-hoc commit range/file/dir** (no plan, no flag context): slug from target string with non-alphanumerics replaced by `-` (e.g., `HEAD~3..HEAD` → `HEAD-3-HEAD`; `src/foo.py` → `src-foo-py`).
  5. **Fall-back**: `adhoc` if no derivable id.

  **`<id>` normalization** (applied to all rules above): lowercase; collapse repeated `-`; trim leading/trailing `-`; max length 80 chars; if longer, truncate to 72 chars + `-<8-char-hash>` derived from the canonical pre-truncation string + reviewer list. Final filename: `<id>-<YYYYMMDDTHHMMSSsssZ>.md`.

**No surface-index pointer file is written.** Discoverability for `/ae:dashboard` and `/ae:next` is preserved via non-recursive glob scan over `output.reviews/*.md` (excluding `adhoc/` subdir naturally — non-recursive glob does not descend) and `.ae/features/{active,done}/F-*/review.md` — see those skills' Reviews scanning rule. This eliminates dual-write debt; readers, not writers, bridge the two locations. Ad-hoc reviews under `output.reviews/adhoc/` are NOT scanned by dashboard/next/plugin-stats/retrospect (cross-skill contract; verified across all 4 review-reading skills as of F-012).

Review file frontmatter:

**Pipeline mode (case (a) and (b))** — `verdict` required:

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

The `verdict` field is required in pipeline mode — it enables `/ae:dashboard` and `/ae:next` to determine review completion without reading file content.

**Ad-hoc mode (case (c))** — `verdict` MUST be omitted:

```yaml
---
title: "Review: <target-derived-name>"
type: review
created: YYYYMMDDTHHMMSSsssZ    # filesystem-safe + millisecond precision; same form as filename timestamp; collision-free across rapid invocations
target: "<commit-range | file-path | dir-path | plan-path-with-rerun>"
mode: adhoc                      # explicit marker to disambiguate from pipeline
reviewers: [<list of agent names spawned>]   # ALWAYS written in ad-hoc mode (with or without --reviewer flag); records actual spawn for audit
---
```

The `reviewers:` field is **always required in ad-hoc mode** regardless of whether `--reviewer` flag was used. When `--reviewer` flag was used, the list reflects the explicit override. When the default selection table was used (plain ad-hoc, no flag), the list reflects the actual default-selection result. This makes ad-hoc reviews fully self-describing without depending on the invocation transcript.

**Why `verdict` is omitted in ad-hoc mode**: dashboard/next infer pipeline progress from `verdict: pass`. An ad-hoc review of `HEAD~3..HEAD` or a re-review with override reviewers does not represent a pipeline gate transition; emitting `verdict:` would either (a) corrupt pipeline state if scanned, or (b) confuse dashboard if it ever scans `adhoc/` (current contract: it does not scan, but defense-in-depth wins). The `mode: adhoc` field is an explicit second guard.

**Cross-skill contract** (verified F-012 dogfood Layer A): the 4 review-reading skills (`ae:dashboard`, `ae:next`, `ae:plugin-stats`, `ae:retrospect`) all use non-recursive glob `output.reviews/*.md` which naturally excludes `output.reviews/adhoc/*.md`. Future modifications to these skills MUST preserve non-recursive scan behavior; recursive scan would silently surface ad-hoc reviews into pipeline state.

Report contents:
1. TL synthesis report (merged findings from all reviewers + challenger + cross-family, with Disagreement Value Assessment and severity classification)
2. Outcome statistics (rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate)
3. Fixups squashed
4. Deferred findings audit results (FIXED/WAIVED/UNRESOLVED classification from Check 4), backlog items to `pipeline.yml` → `output.backlog/unscheduled/` (default: `.ae/backlog/unscheduled/`) — sprint assignment via `/ae:roadmap plan` later
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
