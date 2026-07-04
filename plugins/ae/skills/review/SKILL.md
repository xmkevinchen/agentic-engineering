---
name: ae:review
description: Deep multi-agent review + fixup (feature completion gate). Recommended: Sonnet or above
argument-hint: "<plan file path>"
user-invocable: true
model: opus
effort: xhigh
---

<!-- ae-output-standards-v1 -->
## AE Output Standards

All deliverables (SendMessage to TL, git-tracked docs, TL replies) MUST follow:
- Line 1: conclusion / judgment / action (one sentence)
- Phase summary: `---` + heading separator + bullets
- Documents: pyramid (top ≤ 5 lines TL;DR + supporting detail below)
- Closed loop: reader makes 90%+ judgments without opening lower layers
- Self-verify: re-read your output before sending; misaligned → fix first

Full reference: [AE Output Standards](../../output-standards.md)
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
  1. **Feature-dir plans (primary)**: `.ae/features/{active,done,abandoned,paused}/F-*/plan.md`
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
- Run `check-agent-teams.sh` (exit 0 = available; exit 1 = unavailable, prints the reason)
- If exit 1 → **refuse to execute** and tell user: "Agent Teams is required for `/ae:review` (verdict pass/fail is a load-bearing gate-keeper output — see `docs/agent-teams-policy.md`). Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

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

**Placement rationale**: Check 5 is a blocking gate that re-uses the plan file already loaded by Check 2 (Plan All Done) — adding only one frontmatter-field read plus a conclusion.md stat/read. Independent of Check 2-4 ordering: Check 2 scans step checkboxes, Check 4 parses milestone notes; neither depends on the conclusion.md file Check 5 guards. Grouping it last in the Pre-check chain keeps entry gates together and mirrors `/ae:work`'s Pre-check Check 5 placement at the tail of its Pre-check section.

### Check 6: Protocol Invariant Check

If `git diff --name-only <feature-base>...HEAD` (the cumulative review scope, across all step commits in the feature — same base as the `## Execution: Agent Teams Review` § "Review scope": feature branch → `main...HEAD`, main branch → `<feature-start>..HEAD`) includes files under `plugins/ae/skills/` or `plugins/ae/agents/`:

1. Run `/ae:test-plugin --regression --layer1` targeting the changed skills/agents (Layer 1 static analysis only — do NOT execute Layer 2 during pre-verdict).
2. **Layer 1 failure = P1** (blocks verdict pass via the standard P1 disposition path).
3. **Trace emission** (per trace-schema.md multi-emitter contract): append `{record_type: "review-check-6", skill: "ae:review", check: "C6", outcome, files_checked}` to `~/.ae/traces/<session-id>.ndjson`. Emitted in **both** paths (fire + no-scope below) for firing-rate observability. Outcome: `pass` (Layer 1 clean), `fail` (P1 path above), `skipped_no_scope` (`files_checked: 0`). `files_checked` = count of changed files under `plugins/ae/skills/` or `plugins/ae/agents/` in cumulative diff. `record_type` value MUST be entity-specific (`"review-check-6"`) — generic values like `"check"` are forbidden (future check-type collisions).

If no plugin files in cumulative diff → skip the gate execution (log "No plugin skill/agent files changed across feature commits, skipping protocol check.") but **still emit the trace record** with `outcome: "skipped_no_scope"` per item 3 above.

**Mirrors `plugins/ae/skills/work/SKILL.md` Check C.5** (per-commit pre-commit) at feature-completion-review granularity (cumulative across commits). The two checks are deliberately layered: C.5 catches step-local drift incrementally; Check 6 catches multi-step interaction drift cumulatively. For features with a single plugin-touching commit the two checks fully overlap; for features with multiple plugin-touching commits Check 6's cumulative scope can find issues that per-commit C.5 didn't surface in isolation.

**Validator scope note**: Check 6 records (record_type: `"review-check-6"`) are out of scope for `validate-trace.sh` at v0.10.x — see [trace-schema.md "Validator scope clarification"](../../docs/references/trace-schema.md). Running the validator on a session file will produce one expected false-positive per Check 6 record. This is by design until multi-emitter validation lands.

### Check 7: Harness Satisfaction (F-041)

Confirm the plan's per-AC verification harness (`verify_by`) is actually *satisfied* — this is the review-stage backstop that gives `/ae:work`'s prompt-level hard-block (`work/SKILL.md:489`) real verdict-stage teeth.

**This is reviewer judgment (LLM-driven), not a mechanical parser**: the reviewer re-examines against the **frozen goal** — `<feature-dir>/goal.frozen.md` (the immutable acceptance standard written at plan-approval), **NOT** the mutable live `plan.md` (the executor may have edited it during work); fall back to the plan's `## Acceptance Criteria` section only when no `goal.frozen.md` exists (legacy). Reads each AC's `verify_by` value and judges satisfaction against the diff/output. Pre-F-041 detection = *absence of any `verify_by` field across the plan's ACs* (a property of the text, not a date). A malformed or partial AC section degrades gracefully — judge what is present, do not error out.

For each AC in the plan:
- **Deterministic AC** (`verify_by` ∈ `unit`/`integration`/`e2e`/`contract`): its test must pass (for `contract`: the jq-assertion runner `verify-contract.sh` exits 0). If `/ae:work` recorded the AC as an *unverified deterministic AC* — grep `<milestone-dir>/notes.md` for the `UNVERIFIED_AC [Step N]:` prefix it writes when an empty `test.command` crossed the prompt-level hard-block — and it is still unresolved → **block verdict pass** (P1 path). (With only a global `test.command`, "its test must pass" = the suite covering that AC is green; cite the AC→test link when non-obvious.) **Evidence + isolated judge (F-065 — "machines measure, LLM judges meaning")**: for each deterministic AC, run `collect-ac-evidence.py <goal.frozen.md path — the SAME frozen goal this Check re-examines against; fallback plan.md only when no frozen goal exists> <AC-id>` → it writes a **facts-only** evidence record to `<milestone-dir>/evidence/<AC-id>.json` (`verdict: null`; it decides ONLY vacuity, never AC pass/fail). A **collector-integrity-failure** (nonzero exit — zero-match, below `expected_match.min_count`, or unknown parser with no match-count + exit 0 and no `exit_code_only`) → **block verdict pass** (P1, "evidence vacuous", distinct from "AC failed"); `parser` is read **descriptively**, never branched on a hardcoded list. The **coverage judgment** — do the matched tests credibly cover the AC, or is it a trivial `assert!(true)` that merely matched the filter? — runs in a **fresh, context-isolated, cross-family reviewer** (F-049: not the executor self-grading), given a bundle of {the evidence record + the `matched_tests` **bodies** (open via `file`/`line`, else grep the name) + the AC text + the **frozen goal**} and **NOT** the executor's step-summaries/claims. That judge **writes back** `verdict: {value: pass|fail|waive, rationale: "<one line>", waive_ref: "<notes.md cite if waive>"}` into the evidence record (closes the collector→judge loop; downstream readers consume verdict density as a harness fact, not prose). **Fallback** (cross-family unavailable): degrade to a Claude-isolated judge + flag `cross_family_degraded` (never silent-pass), or block. A deterministic claim with vacuous evidence — or one a trivial test "covers" — is the silent-drop this backstop exists to catch.
- **Judge AC** (`verify_by: judge`): the reviewer evaluates the AC's stated rubric against the actual output, **never the executor's self-report**. For a judge AC whose rubric needs a **captured runtime artifact** (UI screenshot, perf metric, data sample), the executor writes it to `<milestone-dir>/artifacts/<AC-id>.<ext>` and the reviewer evaluates **that artifact** — no artifact at the expected path → **block verdict pass**. For code/doc/prose judge ACs, the **diff/output IS the artifact** the reviewer reads (no separate file). A `judge` AC with **no rubric** or a **failing rubric** → **block verdict pass**. (Committed `judge` enforcement — review-stage rubric-confirmation; no separate engine.) Covers **non-code dimensions — business-data validity, domain invariants, BDD/behavioral scenarios**.
- **`manual` AC**: surfaced for human confirmation in the verdict section; not auto-blocking.
- **WAIVED AC** (any `verify_by`): an AC whose body states it is WAIVED → the reviewer MUST grep `<milestone-dir>/notes.md` for a line **`WAIVED_AC <this-AC-id>: <reason>`** — a waiver KEYED to this specific AC id (a generic deferred-finding `Disposition: WAIVED: <reason>` line is NOT an AC waiver — it has no AC id, so an unrelated finding's waiver must not satisfy an AC). `WAIVED_AC <this-AC-id>:` present → accept the waiver for that AC (the recorded reason is the audit trail; closes the gated-deferral gap for deterministic/`contract` ACs that legitimately did not run). No keyed `WAIVED_AC <this-AC-id>` line → treat as unverified → **block verdict pass** (a prose-only or mis-keyed waiver is the silent-drop this backstop catches). The canonical AC-waiver write format is `WAIVED_AC <AC-id>: <reason>` — distinct from the deferred-finding `Disposition: WAIVED:` form.
- **Confidence per AC (report it)**: tag each AC `strong` (a deterministic check re-ran + passed), `partial` (the judge evaluated an artifact — not a re-run), or `manual` (human-confirmed). Surface the mix in the verdict (e.g. `harness confidence: 5 strong / 2 partial / 1 manual`) so the reader sees how much of "done" is deterministically re-verified vs judged vs human.

If the plan has NO `verify_by` fields → **distinguish by PATH, not date**: a **feature-dir plan** (`.ae/features/.../F-NNN/plan.md`, post-F-041 by construction) with zero `verify_by` → **block verdict pass** (forgotten harness, not legacy); only a **legacy-path plan** (`output.plans/`) → skip with `Harness satisfaction: skipped (pre-F-041 legacy plan)`. Never infer legacy from a date.

### Prior Context (project knowledge graph)

Run this step after Pre-checks pass and before creating the review team. Query = the feature name from $ARGUMENTS or the plan title. (Compact locate-step; canonical long form incl. grep-fallback: analyze/SKILL.md § Prior context.)

1. Regenerate + read the layered index: run `plugins/ae/bin/graph-index-gen.py` (cheap, byte-idempotent), read `.ae/graph/index.md`. Generator fails / no feature dirs → emit `Prior context: unavailable (no knowledge index)` and continue.
2. **[LLM]** Theme-pick: semantically read Tier A + the picked themes' TL;DRs against the query; read the survivor node pages (keep the set small — ≤10; thin/empty results → fall back to the canonical long form incl. grep-fallback in analyze/SKILL.md).
3. **[deterministic]** Traverse the survivors' edges ONE hop in a single batched `plugins/ae/bin/graph-neighbors.py <survivor-id ...>` call; read newly-reached feature targets' pages (BL/disc targets cite from the edge `evidence` alone; a survivor with no edges yields no lines — normal outcome, not an error; the ≤10 read cap covers the folded targets too).
4. **[deterministic gate]** Synthesis pages (index tier "Synthesis pages", ids `syn-*`) are read only through the pull gate: run `plugins/ae/bin/graph-page-check.py .ae/graph/synthesis/<syn-id>.md` BEFORE reading a page — fresh → read + cite normally; stale → read, but every citation of it carries an inline `[STALE — re-sync via /ae:knowledge-refresh]` flag at the affected item; DEFECT (non-zero exit) → do NOT read the page, emit one `[DEFECT: <syn-id> not served]` line instead. Rot is never silently served.
5. Present under `## Prior Art from Project Knowledge Base` with provenance per item: `id`, `title`, how located (`theme-pick` / `edge from <id>`), edge `evidence` when edge-located.
6. Include prior review patterns and known issues in reviewer prompts (Step 3) as additional context — treat as background, does not constrain review

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

**Interaction with `### Prior Context (project knowledge graph)`**: the Prior Context step (above) separately retrieves knowledge-graph prior-art results and per its own spec includes them in reviewer spawn prompts "as additional context — treat as background, does not constrain review". The primary bundle and graph prior-art results are BOTH inserted into each reviewer spawn prompt but at different hierarchy levels: primary bundle = primary input (same role as CLAUDE.md); graph prior-art results = advisory background appended AFTER the primary bundle. Do NOT merge them into one block; do NOT drop the prior-art results when embedding the bundle.

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:review creates a Pre-check task + **2 floor tasks unconditionally**, plus **0–3 specialist tasks sparse-filled** when the diff selects that lens (F-067 §2/§3 — a specialist task appears iff a reviewer will fill it). NO additional per-phase tasks for Synthesis / Fixup / Outcome Statistics / Output / Completion Invariant — those are sub-actions of the review cycle.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:review: Pre-check` | At skill start (before Check 1) | Immediately before Check 1 | After Check 5 passes |
| `ae:review: Code review (generalist floor)` | At §2 (unconditional floor, per agent-teams §H Rule 1) | When code-reviewer is spawned in §3 | When its findings arrive at TL via SendMessage |
| `ae:review: Cross-family challenge + synthesis` | At §2 (unconditional floor) | When challenger / first proxy is spawned in §3 | When the last cross-family / challenger reply arrives |
| `ae:review: Security review` *(sparse — only if selected)* | At §3, ONLY when the sparse-fill selects `security` (risk-floor-forced or soft-added) | When security-reviewer is spawned | When its findings arrive at TL via SendMessage |
| `ae:review: Performance review` *(sparse — only if selected)* | At §3, ONLY when the sparse-fill selects `performance` | (same) | (same) |
| `ae:review: Architecture review` *(sparse — only if selected)* | At §3, ONLY when the sparse-fill selects `architecture` | (same) | (same) |

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Execution: Agent Teams Review

**Review scope**: determine base commit (feature branch: `git diff main...HEAD`, main branch: `git diff <feature-start>..HEAD`).

**Task lifecycle (Pre-check)**: at the very start of Pre-checks (before Check 1), `TaskCreate(subject: "ae:review: Pre-check")` and immediately `TaskUpdate(taskId, status: "in_progress")`. After Check 5 passes (control reaches Per-review Primary Context Bundle assembly), `TaskUpdate(taskId, status: "completed")`.

### 0. Deterministic risk-floor + selection trace (F-067)

Review lenses are **sparse-filled** from a structural floor (F-067 disc 001): the generalist floor (§1/§2) always runs; specialist lenses are ADDED on signal, never dropped from a full set. To make lens selection auditable AND keep the safety-critical lenses independent of the LLM, run the **deterministic risk-floor BEFORE any LLM soft-add**, and record selection provenance in four trace fields.

**Risk-floor (deterministic, LLM-independent)** — run before reviewer selection:
```
# Use the SAME computed review scope as the reviewers (## Execution → "Review scope"):
#   feature branch → main...HEAD ; main branch → <feature-start>..HEAD ; ad-hoc → the commit range.
# Do NOT diff the raw <target>: in pipeline mode <target> is the PLAN PATH, so
# `git diff --name-only <plan-path>` lists nothing and the floor goes silently inert (C-P1).
git diff --name-only "$REVIEW_SCOPE" > <tmp>/changed-paths    # $REVIEW_SCOPE = the computed range, never the plan path
# Extract work.security_patterns globs from pipeline.yml into <tmp>/patterns, one per line.
# The helper normalizes YAML list syntax (`  - "auth/*"` → auth/*), so a raw grep of the
# block's list lines is sufficient; no need to hand-strip dashes/quotes.
sh risk-floor-lenses.sh <tmp>/changed-paths <tmp>/patterns   # → forced lenses (risk-floor-lenses.sh resolves on bin/ PATH — Wave-1 bare-invocation convention)
```
Any lens emitted here is **forced into the final set regardless of the soft-add** — a 3-line auth/migration/secret change forces `security` even if an LLM stat-read would judge it minor (the soft-add cannot omit a floor-forced lens). This is deterministic *given the current `work.security_patterns` globs* (a user-maintained artifact that can drift — it does not prove the glob list is complete; a security-sensitive path under no glob gets no floor, the honest limit tracked as the glob-staleness backlog item BL-176).

**Selection trace — four provenance fields** (so an audit can tell WHICH path produced a lens, not just that it appeared):
- `baseline_lenses` — the always-on structural floor (challenger + code-reviewer; see §1/§2).
- `risk_floor_lenses` — output of `risk-floor-lenses.sh` (deterministic).
- `soft_added_lenses` — specialist lenses the LLM ADDED on positive diff evidence (§3).
- `final_lenses` — `union(baseline, risk_floor, soft_added)`.

Emit these alongside the existing Layer 1/Layer 2 selection trace. The trace **records** the selection; it does not **prove** the soft-add judged correctly (F-067 honesty scope). Tier-2 deferred: committed `review_lenses:` tags — add only at the first production incident where a soft-signal miss ships a real issue (see `docs/references/trace-schema.md`).

### 1. Select Reviewers

**Before spawning teammates** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

**Always-on generalist floor (F-067, → `baseline_lenses`)**: UNCONDITIONALLY spawn the two-agent floor on every review, before any signal-based specialist selection and regardless of diff signals:
- **`challenger`** — attacks decisions (should this exist? blind spots).
- **`code-reviewer`** — catches implementation-correctness bugs (is this correct?).
These two are non-overlapping (a strategy-clean design with a planted implementation bug: challenger misses it, code-reviewer catches it). The floor is **structural**, not signal-chosen — this is what makes the never-drop invariant (`final_lenses ⊇ baseline_lenses`) deterministically true. Record them in `baseline_lenses`.

**`ceremony: minimal` manual override (F-067 user decision 2b)**: the ONLY way to drop below the floor. Read `ceremony` from pipeline.yml — if `minimal`, the floor may reduce below the two-agent baseline for trivial reviews. There is NO automatic trivial-detector; dropping the floor is always an explicit human act via this preset. (`light`/`full` do NOT drop the floor.)

### 2. Create Tasks (floor unconditional; specialists sparse-filled in §3)

Batch-create **only the floor tasks** unconditionally (F-067 sparse-fill — the floor always runs; specialist tasks are created in §3 only for lenses actually selected, never pre-batched as empty panel noise):

```
TaskCreate(subject: "ae:review: Code review (generalist floor)")
TaskCreate(subject: "ae:review: Cross-family challenge + synthesis")
```

Specialist-lens tasks (Security / Performance / Architecture) are created in §3 **only for lenses the sparse-fill selects** (risk-floor-forced or soft-added) — a task appears iff a reviewer will fill it. Track the floor task IDs alongside the team handle; specialist task IDs are tracked as §3 creates them. Synthesis, Fixup, Outcome Statistics, Output, and Completion Invariant are sub-actions; they do NOT get their own tasks.

### 3. Select and Launch Reviewers

Every reviewer spawn prompt below embeds the primary-context bundle verbatim (see "## Per-review Primary Context Bundle" above). Cross-family proxies receive the bundle text in their spawn prompt — NOT a path reference.

**Select reviewers (sparse-fill — ADDITIVE, never prune)**: the floor (challenger + code-reviewer, §1) ALWAYS runs. On top of the floor, **ADD** a specialist lens (security / performance / architecture, per the Agent Selection Reference signal table) ONLY when the diff shows **positive evidence** for it, OR when the deterministic risk-floor (§0 `risk_floor_lenses`) forced it. This is **additive**: you ADD lenses to the floor on evidence — you NEVER start from the full specialist set and prune down. "No security lens" means the diff showed no security evidence AND no risk-floor match (the absence of a trigger), NOT a dropped lens. Record LLM-added specialists in `soft_added_lenses`; create each selected specialist's task (per §2) as you select it. The final spawned set is `final_lenses = union(baseline_lenses, risk_floor_lenses, soft_added_lenses)` — ALWAYS ⊇ `baseline_lenses` (the floor is structurally unconditional) and ⊇ `risk_floor_lenses` (a forced lens cannot be vetoed by the soft-add).

### `--reviewer <name>` flag (override default selection)

`$ARGUMENTS` may include one or more `--reviewer <name>` flags. Each flag occurrence specifies one reviewer to spawn. Examples:

- `/ae:review HEAD~3..HEAD --reviewer challenger` → ONLY challenger *as the specialist set* (the §1 floor still spawns — see floor carve-out below)
- `/ae:review HEAD~3..HEAD --reviewer codex-proxy --reviewer gemini-proxy` → ONLY both proxies *as the specialist set* (floor still spawns)
- `/ae:review HEAD~3..HEAD` (no flag) → existing default selection table (current behavior)

("ONLY" throughout this section scopes the *specialist* selection; the floor is never dropped by `--reviewer` — only `ceremony: minimal` drops it.)

**Override semantics (NOT additive)**: when one or more `--reviewer` flags present, **skip the default Agent Selection Reference _specialist_ table entirely** and spawn the listed agents. This is intentional override — the use case is "I want exactly these specialist reviewers, not the default mix" (D3 re-review with specific angle).

**Floor survives `--reviewer` (F-067 — resolves the AC2/AC6 contradiction)**: `--reviewer` overrides only the *specialist* selection; the §1 always-on floor (`challenger` + `code-reviewer` → `baseline_lenses`) STILL spawns. So `final_lenses` remains ⊇ `baseline_lenses` even under `--reviewer` (AC2 "ALWAYS" holds), and `ceremony: minimal` stays the **ONLY** path that drops the floor (AC6). The "Spawn ONLY the listed agents" examples below describe the *specialist* set the override controls — the floor is always added on top (deduplicated if a floor agent is also listed). To review *below* the floor, use `ceremony: minimal`, never `--reviewer`.

Concrete examples to prevent ambiguity (each implicitly also spawns the floor unless `ceremony: minimal`):

- **WRONG behavior** (additive interpretation): `/ae:review HEAD --reviewer security-reviewer --reviewer challenger` → runs security + challenger PLUS default selection table reviewers (architecture / cross-family / etc).
- **CORRECT behavior** (override per F-012): `/ae:review HEAD --reviewer security-reviewer --reviewer challenger` → security + challenger as the *specialist set*; the default *specialist* table is SKIPPED. The §1 floor (challenger + code-reviewer) still spawns regardless (dedup if listed).

**Multi-flag is additive AMONG flags, but collectively override default**: `--reviewer X --reviewer Y` selects both X and Y as the specialist set (additive to each other), but skips the default specialist table (collective override). Listing 5 `--reviewer` flags selects 5 specialists, no default specialists added — the §1 floor still spawns on top.

**Scale anchor — what "skip default table" actually means** (silent quality degradation risk if user thinks adding to default):

Default selection table per `ae:agent-selection` SKILL.md typically adds **2-3 specialists** on top of the floor (e.g., security/architecture + cross-family proxies on signal). Using `--reviewer challenger` alone means:

- Specialist set: just challenger (the floor — challenger + code-reviewer — still spawns regardless)
- **Skipped**: the default *specialist* additions (architecture-reviewer / security-reviewer / codex-proxy / gemini-proxy depending on diff signals)

Using `--reviewer` is a **deliberate reduction of the specialist set** (never below the floor — `ceremony: minimal` is the only path below the floor), not an addition. If user wants challenger PLUS the default mix, they need to either (a) not pass `--reviewer` flag (default mix runs), or (b) explicitly list every reviewer they want in `--reviewer` flags.

**Future additive variant** (forward-reference): if `--reviewer` override proves insufficient (likely 60%+ within 6 months per regret analysis), v0.11.x may add `--add-reviewer <name>` flag (additive to default table, POSIX-style two-flag split — keep `--reviewer` as override, `--add-reviewer` as additive). F-012 deliberately defers this to keep scope minimal.

**Invalid name handling**: each `--reviewer <name>` value MUST be a valid agent name (e.g., `challenger`, `codex-proxy`, `architecture-reviewer`, `ae:engineering:minimal-change-engineer`). Unknown name → **hard fail** with full list of valid names. Do NOT silently skip unknown names (would silently shrink review coverage).

**Combined with target**: `--reviewer` flag is fully orthogonal to `<target>` argument; both can be specified. Example: `/ae:review src/foo.py --reviewer security-reviewer` → review the file with security-reviewer as the sole specialist (the §1 floor still spawns).

**Not on ae:code-review**: this flag is ae:review only. ae:code-review's 4-track structure is fundamentally multi-reviewer; single-reviewer use cases route through ae:review with `--reviewer`.

**Cross-family**: Read `cross_family` from pipeline.yml. Follow the cross-family rules in the **Agent Selection Reference** skill — different angles per proxy. If a proxy fails to connect, it should SendMessage to **team-lead** and exit gracefully.

**Task lifecycle (per-track)**: when each reviewer agent is spawned, immediately `TaskUpdate(reviewerTaskId, status: "in_progress")` for the track that reviewer covers. Track-to-task mapping: code-reviewer → `Code review (generalist floor)`, security-reviewer → `Security review`, performance-reviewer → `Performance review`, architecture-reviewer → `Architecture review`, challenger + cross-family proxies → `Cross-family challenge + synthesis` (one shared task). The two floor task IDs come from §2; specialist task IDs come from the §3 sparse-fill create (only for selected lenses).

**Launch all in one message** (`run_in_background: true`):

```
# For each selected reviewer:
Agent(subagent_type: "<reviewer>", name: "<reviewer>",
      run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>

               📋 Cast: <reviewer>
                  Role: <reviewer-domain> reviewer
                  Angle: <your-domain-specific-focus>
                  Why: <domain match for changed file signal per Layer 2 selection>

               Review <diff-range> for <your domain>. Follow Team Communication Protocol.
               Teammates: [other selected reviewers], challenger.
               SendMessage findings to team-lead when done.")

# Always include challenger (pure opposition — does NOT synthesize):
Agent(subagent_type: "challenger", name: "challenger",
      run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>

               📋 Cast: challenger
                  Role: opposition (review mode)
                  Angle: blind spots in reviewer + cross-family findings
                  Why: mandatory adversarial pass before TL synthesizes (mode behavior embedded here, not in agent body)

               Review mode protocol steps (embedded per F-019 mode migration):
               1. Parallel Launch: independent review (blind spots reviewers might miss — hallucinated code, edge cases, type lies) + call Codex independently + call Gemini on high-risk files. Track reviewer findings arrival.
               2. Compare and Merge: after all reviewer findings arrive, merge 6 sources (3 Claude reviewers + Codex + Gemini + your own). Deduplicate, flag severity disagreements, mark unique findings.
               3. Targeted Challenges: for each disagreement, SendMessage to the specific reviewer with cross-family opinions; wait for response; max 2 follow-up rounds with Codex/Gemini.
               4. Aggregate and Report: compile final findings with discussion evidence (final severity, who said what, cross-family opinions). SendMessage to team-lead.

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
      run_in_background: true,
      prompt: "<PRIMARY CONTEXT BUNDLE — substitute literal assembled bundle text here per 'Per-review Primary Context Bundle' section above:
                 1. Plan AC list
                 2. Conclusion body (verbatim, when discussion-referenced per Check 5)
                 3. Framing body (verbatim, if exists)
                 4. Commit range descriptor>

               📋 Cast: <proxy>
                  Role: cross-family reviewer (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; complements core review

               Review <diff-range> via <proxy> MCP. <assigned angle>.
               SendMessage findings to team-lead when done.")
```

**No worktree isolation** — teammates need SendMessage communication.

**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference — proxy 120s MCP timeout + 120s wait timeout.

### 4. TL Synthesizes Final Report

**Task lifecycle (per-track completion)**: when each track's findings arrive at TL via SendMessage, immediately `TaskUpdate(reviewerTaskId, status: "completed")` for that track. The floor + any sparse-filled specialist tasks transition independently as their reviewers finish. The "Cross-family challenge + synthesis" task transitions when the last cross-family / challenger reply arrives (it's a shared task across challenger + 2 proxies).

TL collects all findings from reviewers + challenger + cross-family proxies, then synthesizes:
- Merge overlapping findings, resolve contradictions
- Produce Disagreement Value Assessment where reviewers disagreed
- Classify by severity (P1/P2/P3)
- **KL #1 substitution check**: for each plan step whose checkbox claims `/ae:code-review` ran, require evidence of multi-track execution — either (a) a `milestones/code-review-step-<N>.md` file matching the step number, OR (b) a commit message from that step's commit(s) containing a `/ae:code-review` output reference. **"Multi-track execution"** = the artifact (or commit-message disclosure) names ≥ 2 distinct review tracks among {Claude inline, Codex, Gemini, Doodlestein} — TL inline prose alone counts as Track 1 only and does NOT satisfy. If evidence is absent OR the artifact/disclosure shows only Track 1 → emit the finding in plain language first: `Substitution warning: step N claimed a multi-track code review that did not actually run (internal code KL #1)` — the human meaning leads, the code stays in parentheses as the audit anchor (output-standards.md Rule A). **Default severity P2.** When the same step (matched by step number) ALSO has a P1/P2-logic defect this review separately surfaced, append `[ELEVATED]` tag to the finding entry and TL MUST flag for explicit human triage in the verdict section (do NOT silently re-class to P1 — that conflicts with the P1 definition at line 414 which scopes P1 to security/data/crash). Documented substitution (commit message explicitly states `[KL#1] ... SUBSTITUTED` with rationale) still emits the finding — visibility is the goal, not absence of substitution; the disclosure itself counts as the substitution evidence the rule fires on.

If any agent idle > 5 minutes without sending findings, SendMessage to prompt.

### 5. Shutdown Teammates

After report arrives, send shutdown_request to all teammates (cleanup is automatic at session end).

## Result Processing

### Severity Levels

Display form in user-facing reports glosses the code at first occurrence (hybrid rule — output-standards.md Rule D: translate the label, never change the value):
- **P1 (blocker — security/data/crash)** — security vulnerabilities, data loss, crashes
- **P2 (should fix — logic/perf/maintainability)** — performance, maintainability, architecture issues
- **P3 (minor)** — minor improvements

## Fixup Flow

### 1. Build Mapping Table

```
| Finding | Commit (step) | Fix |
|---------------|-------------------------|------------------|
| Missing guard | abc123 (step 2: repo) | Add null check |
| Unused import | def456 (step 4: screen) | Remove |
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

Open the section with one plain-language line — the verdict before the numbers: `Bottom line: <verdict>, N findings (X fixed, Y deferred), no blockers escaped.` Then compile outcome data for this feature cycle (field labels below are parsed by plugin-stats — byte-exact, never rename; output-standards.md Rule D TRUE SENTINEL):

```
## Outcome Statistics
Bottom line: <verdict>, N findings (X fixed, Y deferred), no blockers escaped.
- Steps completed: N/M
- Rework rate: X steps needed fixup commits (X/N = Y%)
- P1 escape rate: Z P1 findings discovered in /ae:review (should be 0 if /ae:work pre-commit caught them all)
- Drift events: D contract violations during /ae:work (approved: A, fixed: F, rolled back: R, unknown: U)
- Fix loop triggers: N circuit breaker activations during /ae:work (same test file failed max_fix_loops times)
- Auto-pass rate: P steps auto-continued / N total steps (only if auto_pass was enabled)
- Cross-family participation: <verbatim output line from cross-family-counter.sh>
```

Include this in the review report. This data accumulates naturally across features, providing evidence for tuning checklists and gate conditions over time.

**Cross-family participation line (F-033)**: run `cross-family-counter.sh` and emit its output line verbatim as the `Cross-family participation:` entry above. It is a raw **descriptive** counter — how many `/ae:review` invocations ran a full cross-family comparison (≥2 families including a non-Claude family at `state==full`), over the reviews that carry family-tracking data — **NOT a quality metric and NOT a rate framed as quality**. The line leads with the absolute count (not a bare ratio) to avoid a success-rate misreading. The script's own output carries the `flip-rate deferred → BL-115` note and the `<known>/<total> reviews have family-tracking data` coverage disclosure, so reviews with no `families_invoked` data are never read as cross-family failures (the participation-rate-as-quality / vanity-metric trap rejected in the F-033 discussion). The principled flip-rate quality metric is deferred to **BL-115**. **Single emit point** — do NOT add this line to `/ae:retrospect` or `/ae:plugin-stats` in v1 (cross-skill coupling deferred per the F-033 conclusion).

## Output

**Write target rule** (mirrors plan/SKILL.md Step 2 path-derive convention; 3 cases — pipeline + ad-hoc):

- **(a) Feature-dir plan** (target plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`, AND no prior `review.md` at same dir, AND no `--reviewer` flag) → write `review.md` next to the plan at `.ae/features/<state>/F-NNN-<slug>/review.md`. Path-derived; no frontmatter required to make this decision. **Archive-retry exception (F-069×F-070 integration finding)**: when a prior `review.md` exists with `verdict: pass` BUT the feature is still in `active/`/`paused/` (an archive terminal-blocked by the Phase 1.5 trust gate or the Manual-AC guard), a re-run is an **archive-retry, not a re-review** — it stays in case (a): skip re-reviewing (the verdict stands), re-enter the Feature-level archive trigger directly (guard → Phase 1.5 → gate → Phase 2), and only overwrite `review.md` if a fresh review was explicitly requested. Without this exception the blocked feature dead-ends: the re-run would route to ad-hoc (no `verdict:`), and the archive would never re-fire.
- **(b) Legacy plan** (target under `output.plans/`, AND no prior matching review at `output.reviews/`, AND no `--reviewer` flag) → write to `pipeline.yml` → `output.reviews/NNN-...md` per the existing convention.
- **(c) Ad-hoc target OR re-review OR `--reviewer` flag present** → write to `pipeline.yml` → `output.reviews/adhoc/<id>-<timestamp>.md`. Timestamp uses millisecond precision UTC: `YYYYMMDDTHHMMSSsssZ` (no colons, no dashes inside time portion — matches Track 4 staging file convention; prevents sub-second collisions on rapid back-to-back invocations). `<id>` derivation (rules apply in order; **first match wins** — more specific rules listed first):
  1. **`--reviewer` flag with plan target** (plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md` OR `output.plans/NNN-*.md`): feature ID (or legacy plan ID) + `-rerun-<reviewer-name-list>` (multi-flag → join names with `-` after dedup; e.g., `F-012-rerun-challenger-codex-proxy`).
  2. **`--reviewer` flag with non-plan target** (file/dir/commit ref/range — feature-id is undefined): target slug from rule 3 + `-rerun-<reviewer-name-list>` (e.g., `src-foo-py-rerun-challenger`; `HEAD-3-HEAD-rerun-security-reviewer`). Rule 2 covers the gap where flag is set but target has no derivable feature-id.
  3. **Re-review on plan (no `--reviewer` flag, prior `review.md` exists)**: feature ID (or legacy plan ID) + `-rerun` suffix (e.g., `F-012-rerun`).
  4. **Ad-hoc commit range/file/dir** (no plan, no flag context): slug from target string with non-alphanumerics replaced by `-` (e.g., `HEAD~3..HEAD` → `HEAD-3-HEAD`; `src/foo.py` → `src-foo-py`).
  5. **Fall-back**: `adhoc` if no derivable id.

  **`<id>` normalization** (applied to all rules above): lowercase; collapse repeated `-`; trim leading/trailing `-`; max length 80 chars; if longer, truncate to 72 chars + `-<8-char-hash>` derived from the canonical pre-truncation string + reviewer list. Final filename: `<id>-<YYYYMMDDTHHMMSSsssZ>.md`.

**No surface-index pointer file is written.** Discoverability for `/ae:dashboard` and `/ae:next` is preserved via non-recursive glob scan over `output.reviews/*.md` (excluding `adhoc/` subdir naturally — non-recursive glob does not descend) and `.ae/features/{active,done,paused}/F-*/review.md` — see those skills' Reviews scanning rule. This eliminates dual-write debt; readers, not writers, bridge the two locations. Ad-hoc reviews under `output.reviews/adhoc/` are NOT scanned by dashboard/next/plugin-stats/retrospect (cross-skill contract; verified across all 4 review-reading skills as of F-012).

Review file frontmatter:

**Pipeline mode (case (a) and (b))** — `verdict` required:

```yaml
---
id: "NNN" # legacy fallback only; feature-dir reviews MAY omit (path is canonical)
title: "Review: <feature>"
type: review
created: YYYY-MM-DD
target: "<path-to-plan-file>"
verdict: pass # or: fail
---
```

The `verdict` field is required in pipeline mode — it enables `/ae:dashboard` and `/ae:next` to determine review completion without reading file content.

**Ad-hoc mode (case (c))** — `verdict` MUST be omitted:

```yaml
---
title: "Review: <target-derived-name>"
type: review
created: YYYYMMDDTHHMMSSsssZ # filesystem-safe + millisecond precision; same form as filename timestamp; collision-free across rapid invocations
target: "<commit-range | file-path | dir-path | plan-path-with-rerun>"
mode: adhoc # explicit marker to disambiguate from pipeline
reviewers: [<list of agent names spawned>] # ALWAYS written in ad-hoc mode (with or without --reviewer flag); records actual spawn for audit
---
```

The `reviewers:` field is **always required in ad-hoc mode** regardless of whether `--reviewer` flag was used. When `--reviewer` flag was used, the list reflects the explicit override. When the default selection table was used (plain ad-hoc, no flag), the list reflects the actual default-selection result. This makes ad-hoc reviews fully self-describing without depending on the invocation transcript.

**Why `verdict` is omitted in ad-hoc mode**: dashboard/next infer pipeline progress from `verdict: pass`. An ad-hoc review of `HEAD~3..HEAD` or a re-review with override reviewers does not represent a pipeline gate transition; emitting `verdict:` would either (a) corrupt pipeline state if scanned, or (b) confuse dashboard if it ever scans `adhoc/` (current contract: it does not scan, but defense-in-depth wins). The `mode: adhoc` field is an explicit second guard.

**Cross-skill contract**: the 4 review-reading skills (`ae:dashboard`, `ae:next`, `ae:plugin-stats`, `ae:retrospect`) all use non-recursive glob `output.reviews/*.md` which naturally excludes `output.reviews/adhoc/*.md`. Future modifications to these skills MUST preserve non-recursive scan behavior; recursive scan would silently surface ad-hoc reviews into pipeline state.

Report contents:
1. TL synthesis report (merged findings from all reviewers + challenger + cross-family, with Disagreement Value Assessment and severity classification)
2. Outcome statistics (rework rate, P1 escape rate, drift events, fix loop triggers, auto-pass rate)
3. Fixups squashed
4. Deferred findings audit results (FIXED/WAIVED/UNRESOLVED classification from Check 4), backlog items to `pipeline.yml` → `output.backlog/unscheduled/` (default: `.ae/backlog/unscheduled/`) — sprint assignment via `/ae:roadmap plan` later
5. Prompt user to create PR

## Loop-invocation mode (called from the /ae:work harness loop — F-048)

When `/ae:review` runs as an iteration of the `/ae:work` harness loop, the **loop owns lifecycle**, so two defaults change (archive must not precede the loop's hedge + manual gate):

1. **Verdict to the canonical path, overwrite.** Write this iteration's verdict to the plan's canonical `review.md` (Output case (a)/(b) target), OVERWRITING any prior `review.md`. Do NOT route a re-review to an ad-hoc `*-rerun-*.md` file — ad-hoc reviews omit `verdict:`, so the loop would keep reading the stale first verdict and dispatch fixups to the cap even after a successful re-review. The loop re-reads the canonical `review.md` each iteration and needs the FRESH verdict there.
2. **Phase 1.5 edge-write runs EVERY iteration** (it is idempotent by (kind,id)) — only lifecycle is deferred, never the edge pass. Skipping it leaves the archive-time edges unwritten, a write-point gap a later `/ae:knowledge-refresh` has to correct after the fact.
3. **Do NOT execute the Completion Invariant AT ALL** — neither the `status: done` plan-frontmatter writeback NOR the Feature-level archive trigger (deferring only the archive still ran the status writeback every iteration, *including failed ones* — marking the plan `done` before fixup/hedge/manual, which dashboard treats as terminal). Per-iteration loop-mode review writes the verdict (item 1) and edges (item 2); nothing terminal. The loop invokes the ENTIRE Completion Invariant exactly once, at its terminal `exit_pass`, after the hedge passes AND any `verify_by: manual` AC is confirmed.

Standalone `/ae:review` (not invoked from the loop) writes per the Output rule + runs the full Completion Invariant. It archives on `verdict: pass` **only when the frozen goal declares no `verify_by: manual` AC** — see the **Manual-AC human-gate guard** on the Feature-level archive trigger below (BL-174: standalone has no loop to interactively confirm a `verify_by: manual` AC, so on any manual AC it terminal-blocks archive and reports pending, rather than mv-ing the feature past a human gate).

## Completion Invariant

**When this section runs (two distinct invocations — do not conflate):**
- **Per-iteration loop-mode review** → **SKIP this entire section** (the loop is still iterating; nothing terminal yet).
- **Standalone `/ae:review`, OR the loop's terminal `exit_pass` finalize** → **RUN it in full.** At `exit_pass` the loop INVOKES this section as the canonical finalize — it does NOT reimplement or skip it. This section is the single source of truth for lifecycle finalize; "loop-terminal finalize" is a *run*, not a *skip*.

After writing the review file with `verdict:`, update pipeline state:

- [ ] Update plan frontmatter: `status: done` (if not already set by self-healing)
- [ ] Log: `[WRITEBACK] Review written, plan status confirmed done`
- [ ] **Stacked-feature pre-merge reminder (BL-145)**: if the reviewed feature's `index.md` has a non-empty `depends_on` (forward-direction; reader-tolerant — legacy plan / no feature dir / missing or empty `depends_on` → emit nothing), print: `📋 This feature is stacked on <deps> — before merging the stack, run a combined-diff cross-family review of the integrated range (see docs/references/pre-merge-integration-review.md).` This fires here in BOTH paths (standalone `/ae:review` AND the loop's terminal `exit_pass`, which invokes this section) — the merge-moment. A reminder, NOT a gate (the autonomous trigger is deferred, BL-144).

### Feature-level archive trigger (GTD)

**When this trigger runs**: same rule as the Completion Invariant above — **SKIP** during a per-iteration loop-mode review; **RUN** for standalone `/ae:review` AND at the loop's terminal `exit_pass` finalize. At the loop terminal, the loop INVOKES this trigger (it does NOT archive on its own / reimplement it) — so the archive's full side effects (`done:` date, roadmap update, metadata, log, legacy manual-fallback) apply identically whether reached standalone or loop-terminal.

**Manual-AC human-gate guard (BL-174)** — before archiving, read the AC set from the **frozen goal** (`<feature-dir>/goal.frozen.md` — the immutable acceptance standard; fall back to the live plan's `## Acceptance Criteria` ONLY when no `goal.frozen.md` exists, **mirroring Check 7's precedence** — the executor may have edited `plan.md` during work, so `plan.md` is NOT the source of truth here). If it declares **any** `verify_by: manual` AC:

- **Standalone `/ae:review`** with any `verify_by: manual` AC → **STOP — do NOT archive**, even on `verdict: pass`. Emit a **terminal** pass-but-human-pending readout: state the verdict passed, leave the feature in its current state dir (`active/`/`paused/`), list the manual AC(s) awaiting human sign-off, and print the manual-archive command (same shape as the Phase 1 no-linkage fallback message). The readout MUST also note the knowledge-graph consequence (F-069 challenger finding): a human manual `mv` never reaches Phase 1.5, so this feature will receive **no archive-time `relates_to` edges** — if its lineage matters, hand-add human-verified edges to its `index.md` (`written_by: human`, the Step-6 seed pattern) and run `graph-lint.py` scoped on the dir before or after the manual archive. This is a **terminal report, NOT an interactive pause** — standalone has no loop to confirm inside. **A `verify_by: manual` AC ALWAYS blocks standalone auto-archive — there is deliberately NO waiver/confirmed carve-out at the standalone gate** (a manual AC means a human must do BOTH the manual verification AND the archive). Do **not** honor a `WAIVED_AC <AC-id>` line for a `manual` AC here: `WAIVED_AC` is writable by the AI executor during `/ae:work` with zero human involved, so honoring it would let the executor auto-clear a human gate — the exact bug this guard exists to prevent. Rationale: standalone shares loop mode's **unconditional** manual-AC *trigger* (`work/SKILL.md:592` — "if the plan has ANY `verify_by: manual` AC → PAUSE", no waiver exception) but declares its own *terminal action* (refuse-and-report vs the loop's pause-confirm-then-archive), because standalone has no loop to confirm inside. There is no "manual AC present AND confirmed/waived → auto-archive" branch; the human archives manually after doing the manual verification.
- **Loop-terminal `exit_pass`** → manual-AC confirmation already happened in `work/SKILL.md`'s `exit_pass` branch (step 1 PAUSEs for human confirmation of every `verify_by: manual` AC BEFORE invoking this finalize), so the human gate is already satisfied → archive proceeds normally.
- **No `verify_by: manual` AC** (either caller) → archive proceeds on `verdict: pass` exactly as before.

When the guard above permits archiving — `verdict: pass` AND the target plan's feature dir is in `.ae/features/{active,paused}/F-NNN-slug/` — archive the feature (a reviewed-and-passed paused feature is complete → `done/`, per F-032 D7).

**Path-derived archive trigger**: feature-dir plans live at `.ae/features/<state>/F-NNN-<slug>/plan.md`. The archive trigger derives the feature dir directly from the plan path — no frontmatter required, no scan, no ambiguous-match flow. Legacy plans (under `output.plans/`) retain a single explicit-fallback path emitting the manual-archive message.

#### Phase 1 — Locate the feature dir

Try in order. The first match resolves; on no match emit the manual-archive message and STOP (do not proceed to Phase 2).

1. **Feature-dir plan path**: if the target plan path matches `.ae/features/<state>/F-NNN-<slug>/plan.md`, the feature dir IS the plan's parent directory. Path-derived; resolves directly. No frontmatter or scan needed.
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

#### Phase 1.5 — Edge-write + trust gate (F-069)

Runs ONLY between a resolved Phase 1 and Phase 2 — i.e. under the trigger's own "When" rule above (per-iteration loop-mode reviews SKIP the whole trigger, so they never write edges; only standalone `/ae:review` or the loop's terminal `exit_pass` reaches here — same firing condition as the archive itself, no duplicate/premature edges).

1. **Edge-write (LLM judgment)**: regenerate the layered index first — run `plugins/ae/bin/graph-index-gen.py` unconditionally (cheap, byte-idempotent; no staleness heuristic needed) — then read `.ae/graph/index.md` + its `themes/*.md` and identify artifacts genuinely related to the finishing feature. For each true relationship, append a `relates_to` edge to the finishing feature's EXISTING `index.md` `edges:` list — create the key only if absent, NEVER emit a second top-level `edges:` block (duplicate YAML keys silently drop edges). **Idempotent by target**: skip any `(kind, id)` pair already present (a re-run after a blocked archive must first fix/remove the edges the prior lint flagged, then re-append only what's missing — no duplicates). Full provenance per edge:
   ```yaml
   edges:
     - kind: relates_to
       id: <F-NNN / BL-NNN / disc-NNN>
       source: "<artifact>:<line>"   # a path INSIDE the finishing feature's own dir (e.g. plan.md:88 — graph-lint rejects escapes), at the line grounding the relationship
       evidence: "<one-line why the relationship holds>"
       written_by: review-archive
       judge: {value: pass, rationale: "<this review's semantic check of the evidence>"}
   ```
   The `judge` field records this review's OWN semantic verdict that the evidence supports the relationship — the half graph-lint cannot check (AC4b's rubric judges this). **Only write edges that pass that semantic check** (`judge.value: pass`); a relationship that fails it is simply not written — never emit a `judge: {value: fail}` edge. Zero genuine siblings → write zero edges (legitimate outcome, not a failure).
2. **Trust gate (deterministic)**: run `plugins/ae/bin/graph-lint.py --root .ae/features <feature-dir>` (scoped mode — per-node edge checks, no whole-graph checks). Exit 0 → proceed to Phase 2. Non-zero → **terminal-block the archive** (mirror the Manual-AC guard's terminal shape): report pass-but-pending — verdict stays `pass`, feature stays in its current state dir, list each `[graph-lint] DEFECT:` line, print the fix (correct/remove the offending edges in `<feature-dir>/index.md`, then re-run `/ae:review` — that re-run is an **archive-retry**, see the Output rule's archive-retry exception; it does NOT route to ad-hoc). Do NOT flip `verdict:`; do NOT run Phase 2.

**Known gap — manual-AC features (F-069 review finding)**: a feature blocked by the Manual-AC guard exits via a human manual `mv` that never reaches this Phase — such features get no incremental edges through this channel (and Plan 2's batch deliberately writes no semantic edges). The guard's terminal readout tells the human to hand-seed edges when lineage matters; a mechanized path is deferred (revisit in Plan 2).

#### Phase 2 — Execute archive (only when Phase 1 resolved a single feature dir)

1. **Move the feature dir**: `mv .ae/features/<source-state>/F-NNN-<slug>/ .ae/features/done/F-NNN-<slug>/`, where `<source-state>` is the state segment of the plan path resolved in Phase 1 — normally `active`, or `paused` when reviewing a paused feature that passed (F-032 D7: a reviewed-and-passed paused feature is complete → goes to `done/`, not back to paused). Plain `mv` — `.ae/` is gitignored. Atomic on the same filesystem.

2. **Update the feature `index.md` frontmatter** in place:
   ```yaml
   status: done # was: active (or paused — writeback to done either way)
   done: YYYY-MM-DD # today
   ```
   Preserve all other fields. Do NOT remove `origin_bl:` or any optional field — they remain part of the audit trail.

3. **Update roadmap file (if linked).** If the feature's `index.md` has a non-empty `roadmap:` field, locate `.ae/roadmaps/active/<roadmap-name>.md`. If the roadmap file has a body table or list referencing this feature with a status column, update that row (best-effort; don't fail the archive on roadmap edit failure). Log either `[ARCHIVE] Updated roadmap <name>.md feature entry to done` or `[ARCHIVE] Roadmap <name>.md has no parsable feature row; skipped roadmap update`.

4. **Log success**: `[ARCHIVE] Feature F-NNN-<slug> moved to features/done/.`

When `verdict: fail` → **do NOT mv**. The feature stays in its current state dir (`features/active/` or `features/paused/`). The user may, after fixup, re-run `/ae:work` and `/ae:review` for another verdict, OR manually `mv .ae/features/<state>/F-NNN-<slug>/ .ae/features/abandoned/F-NNN-<slug>/` if the feature is being dropped.

### Legacy artifact preservation — known limit

The feature-dir path migration moves NEW work into feature directories but deliberately leaves pre-existing legacy artifacts in `.ae/discussions/`, `.ae/plans/`, `.ae/reviews/` untouched (known limit: existing legacy artifacts are not migrated; they age out naturally as new work supersedes them). The audit chain is therefore split based on each artifact's birth date:

- **Feature-dir features (post-migration)**: `features/{active,done,abandoned,paused}/F-NNN-<slug>/` contains origin-BL + feature frontmatter + analysis + plan.md + review.md + discussions/.
- **Pre-migration features**: feature dir contains origin-BL + index + analysis only; plan + review files remain in legacy `.ae/plans/`, `.ae/reviews/` (linked via discussion id chain or optional `feature: F-NNN` frontmatter on legacy plans).

The archive trigger **does not** attempt to collect or symlink legacy plan/review files into the feature dir for pre-migration features. Cross-references work via frontmatter `id:` (feature/plan/review IDs are stable across mv — directory location is not load-bearing for lookup). Run `/ae:roadmap` or `/ae:dashboard` to verify the feature shows up in `done/` and the linkage chain still resolves across both locations (dashboard/next union-scan both legacy and feature-dir reviews per the feature-dir migration Step 5).

### Cross-references survive the mv

AE internal cross-references use frontmatter `id:` not path strings. `mv` of the feature dir does not break:

- `BL-NNN.md` `promoted_to: F-NNN` → still resolves (grep for `id: F-NNN` across `features/{active,done,abandoned,paused}/`).
- Plan/review path-derived feature ID: when plan.md / review.md live inside the feature dir, the dir IS the feature ID — no frontmatter required, no scan, archive trigger Phase 1 step 1 resolves directly.
- Optional `feature: F-NNN` frontmatter (legacy bridge): readers validate against parent dir path and warn on mismatch; path always wins.
- `ae:roadmap` section (a) `origin_bl:` dedup → already scans active+done+abandoned per Step 4 fix.
- `ae:roadmap` section (d) archive prompt → recognizes a fully-done roadmap when all linked features are in `done/` (or `done/`+`abandoned/`).

### Recovery — undoing an archive

Archive is `mv .ae/features/<source-state>/F-NNN-<slug>/ .ae/features/done/F-NNN-<slug>/` (source = `active` or `paused`) plus an in-place `index.md` frontmatter edit. To undo (e.g., the user got a `verdict: pass` they later disagree with), restore to `active/`:

1. `mv .ae/features/done/F-NNN-<slug>/ .ae/features/active/F-NNN-<slug>/`.
2. Edit the moved `index.md` frontmatter: revert `status: done` → `status: active`, remove the `done:` field.
3. (Optional) If the archive trigger updated a roadmap row to `done`, edit that row back to its prior state (or run `/ae:roadmap` to see the corrected state and re-match by hand).

Plan/review files in legacy paths are unaffected by archive (they were never moved by the trigger). The review file's `verdict:` field stays as written; if the user wants to rebut, they edit the review file's frontmatter or write a new review pointing at the same plan.

Recovery is a manual flow — automation would require persistent archive-history; deferred until a real need emerges.

## Next Steps

Based on review outcome, suggest with exact executable command:
- If review passed → `Review passed.` Suggest next action based on project's source control workflow and context. Let user decide.
- If review has P1 findings → `P1 findings remain. Fix and re-run /ae:review <plan-file-path>`
- If review deferred items → `Deferred items exist. Address in next iteration or /ae:plan for follow-up.`

## Trace emission (final step)

Before skill exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit 9-field trace record to `~/.ae/traces/<session-id>.ndjson` (no LLM content, per-skill-invocation metadata for v0.11.x consumers).
