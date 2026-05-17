# Changelog

## Unreleased

### F-009 Step 2 — BREAKING: `action: force` no longer silently bypasses stack-mismatch (commit pending)

`.claude/agent-governance.md` now carries a top-level `schema_version:` field. Behavior split:

- **`schema_version: 1`** (default when field is absent) — legacy behavior preserved verbatim: `action: force` rules short-circuit Layers 2+3 AND bypass the stack-mismatch filter. AE emits a one-time trace warning recommending upgrade.
- **`schema_version: 2`** — `force` agents go through the stack-mismatch filter by default. Per-rule field `stack_check: enforce|skip` controls mismatch handling:
  - `stack_check: enforce` (default when omitted) — stack-mismatch triggers `AskUserQuestion` (accept / drop / abort)
  - `stack_check: skip` — preserve legacy silent-bypass on a per-rule basis (trace records the bypass for audit)

**Trace event supersession**: when a force agent triggers the stack-mismatch path (detected or SKIPPED), the legacy `[layer1] hard-constraint: stack-mismatch filter REMOVED <agent>` event is suppressed for that agent — the new `[layer1] force-apply: <agent> stack-mismatch ...` line is the single authoritative record. Hard-constraint stack-mismatch events continue to fire normally for non-force agents.

**Migration steps**:
1. Audit existing `.claude/agent-governance.md` files for `action: force` rules whose target agent has a `tech_stack:` disjoint from the project's.
2. To preserve current silent-bypass behavior, either leave the file at `schema_version: 1` (legacy auto-applied) or set `schema_version: 2` AND add `stack_check: skip` to each affected rule.
3. To adopt the safer prompt-on-mismatch behavior, set `schema_version: 2` and leave `stack_check` unset (defaults to `enforce`).

**Files**: `plugins/ae/skills/agent-selection/SKILL.md` (governance schema versioning section + Flow per slot step 1 + trace examples)

---

## v0.9.7 — 2026-05-10

### F-015 review fixup (commit `befd107`)

Patch release fixing 2 P1 findings from `/ae:review` 3-reviewer pass missed in v0.9.6:

- **Inline block in `ae:work` + `ae:review` SKILL.md**: was 4-bullet (missing Standard 5 self-verify); rewritten to 5-bullet per plan AC3 spec (`## AE Output Standards` heading + 5 bullets including Self-verify + relative link). Standard 5 is the core behavioral innovation — it must reach agent context, not just live in the canonical doc.
- **Drift fixture removed**: `plugins/ae/tests/fixtures/standards-drift-detection.md` deleted. Plan v3 explicitly dropped the fixture in "What we did NOT do" section ("shell script byte-compare 有限码判无限输出, brittle"); v0.9.6 ship erroneously included it. Standard 5 self-verify is the primary enforcement mechanism, not external fixture.

### Why patch release

v0.9.6 (commit `fbc79f8`) shipped before `/ae:review`'s 3-reviewer pass surfaced the 2 P1. Original review (in v0.9.6) treated 4-bullet inline as PASS and treated drift fixture as deliverable. Multi-reviewer review (architecture + challenger + codex-proxy) caught both — challenger uniquely caught Standard 5 missing.

Audit trail: `.ae/features/done/F-015-session-readout-ae-status-dashboard-curr/review.md` includes both original review (cfd8c5e snapshot) and supplementary review (befd107 corrected state).

### No API / breaking changes

Pure inline-block content fix + fixture removal. No skill behavior changes, no schema migrations, no deprecations.

---

## v0.9.6 — 2026-05-10

### F-015 — Output Standards Landing to Plugin (Plan 015, review verdict PASS 2026-05-10)

- **`plugins/ae/output-standards.md` (107 lines, new)**: single source of truth for AE output standards (5 standards: session-process Line 1, phase-summary `---` segmentation, document pyramid tip ≤5 lines, closed-loop 90%+ readability, self-verify protocol). Template form (fill-slot) + 8-doc pyramid-tip guide + anti-pattern examples + scope definition. English prose, git-tracked.
- **Inline reference in 4 high-traffic skills**:
  - `plugins/ae/skills/work/SKILL.md` + `plugins/ae/skills/review/SKILL.md`: 8-line inline block (standards summary + link to canonical)
  - `plugins/ae/skills/plan/SKILL.md` + `plugins/ae/skills/discuss/SKILL.md`: 1-line pointer
  - Path resolution: `../../output-standards.md` (relative, 2 levels up from `plugins/ae/skills/<x>/SKILL.md`)
  - `plugins/ae/skills/analyze/SKILL.md` already contains inline reference (pre-existing, line 236)
- **Standards drift detection**: `plugins/ae/tests/fixtures/standards-drift-detection.md` (manual verification fixture, detects byte/semantic drift between canonical + inline blocks)
- **Cleanup**: removed misplaced `## Output Standards` section from project-level CLAUDE.md (moved to plugin canonical)
- **Phase 2 dogfood-driven expansion**: 4-skill minimum carrier (work/review/plan/discuss) + analyze = 5-skill coverage ≈90%+ of session output. Other 18 skills follow Phase 2 observation; decision on full coverage deferred to empirical feedback.
- **Rationale**: LLM cannot guarantee 100% standard adherence; short path preferred (template in agent context → agent/TL re-read → fix or ship) over external shell-script fixtures (brittle) or third-party LLM judge (adds noise). Standard 5 (self-verify) is primary enforcement mechanism.
- **External-project readiness**: projects consuming ae plugin receive standards guidance inline on `/ae:work` and `/ae:review` day 1; no external fixture or judge dependency.

### Closes

- F-015 (BL-070 root-cause; closure review verdict: PASS, 2026-05-10; 7/7 ACs verified; feature archived to `done/`)

## v0.9.5 — 2026-05-08

Two UX-friction-themed features ship together: F-006 (BL-061 + BL-062 — ae:setup new-project GTD-first defaults + ae:roadmap default auto-eval unsized features with cache) + F-007 (BL-063 — ae:roadmap batch-approve PROMOTE candidates → chains /ae:analyze with pre-approved values).

### F-006 — Roadmap + Setup UX wave (BL-061 + BL-062, content commits `e4a2891` / `4320231` / `90fda45` / `e7db11b` / `9915334`)

- **12 reader skills' default fallback paths normalized to `.ae/<slot>/`** (was: divergent — some skills said `.ae/<slot>/`, others said `docs/<slot>/`). Codex plan-review surfaced this as a "split-brain" risk that would have been triggered by F-006 Step 2 if not normalized first.
- **`ae:setup` writes minimal pipeline.yml on fresh init** (Step 2): no uncommented `output:` block by default; only writes a slot when migration scenario detected (legacy `docs/<slot>/` directory has content). Precedence rule: when both `docs/<slot>/` and `.ae/<slot>/` exist with content, `docs/<slot>/` wins (legacy migration signal).
- **`ae:roadmap` section (c) inline auto-eval for unsized features** (Step 3): replaces "unsized: N" listing with LLM-evaluated T-shirt sizes + cache to `.ae/cache/auto-size.yml` (16-hex sha256 prefix). Eval-order guard: `size:` check fires FIRST, then cache check — closes silent-failure mode where stale cache could display `[cached]` for a sized feature. `[cached]` vs `[evaluated]` annotation = deterministic L1-testable signal.
- **7 new L1 fixtures** (Steps 4 + 5): 4 setup fixtures (defaults-canonical / no-output-block / migration-existing-docs / precedence-coexist) + 3 roadmap fixtures (auto-size-unsized / size-cache / size-cache-cleanup-on-sized). Replaced obsolete `setup-six-output-slots-default` fixture pair.
- **Behavioral change**: external GTD-first projects no longer see 6 redundant `output.*` paths on fresh init (cleaner pipeline.yml). External projects with `docs/*` legacy layout: detection works as before. **BC**: existing projects with `output.*` set to canonical `.ae/<slot>/` defaults receive a one-time interactive cleanup offer in `update` mode (interactive only — non-interactive preserves user values).

### F-007 — Batch-approve PROMOTE candidates (BL-063, content commits `5231f74` / `380ba06` / `5a91046`)

- **`/ae:roadmap` section (a) batch-approval block** (Step 1): when ≥1 PROMOTE verdict, renders structured approval block with provenance-tagged size + depends_on per BL (`[frontmatter]` / `[inferred]` literals). 2-step `AskUserQuestion` flow: Step A 3-option (`Approve all` / `Remove some` / `Cancel (nothing will be promoted)`) + Step B `multiSelect: true` keep-list when Remove some chosen. Cancel = zero `/ae:analyze` invocations.
- **`/ae:analyze` accepts `PRE_APPROVED_VALUES` sentinel block** (Step 2): when invoked from `/ae:roadmap` orchestration loop, spawn prompt contains `---PRE_APPROVED_VALUES---` ... `---END_PRE_APPROVED_VALUES---` block with size + depends_on; Step 7 + Step 8 skip `AskUserQuestion`, write directly. Standalone `/ae:analyze BL-NNN` invocations (no block) behave unchanged. Bilateral discipline: Step 1 in `roadmap/SKILL.md` owns canonical format spec; Step 2 in `analyze/SKILL.md` references it (does NOT redefine).
- **Malformed-block fallback**: missing closing sentinel / invalid `size:` value / invalid `depends_on:` value → loud warning log + fall-through to interactive prompt for that field. Closes the 3-voice-convergent (gemma + challenger + codex) sentinel-parsing brittleness concern raised at ship review.
- **3 new L1 fixtures** (Step 3): `roadmap-batch-approval-block-format` + `roadmap-batch-approval-askuserquestion` + `analyze-pre-approved-values-input` (incl. malformed-block fallback assertions added at ship review).
- **BC**: zero behavior change for direct `/ae:roadmap` (when no PROMOTE candidates) and zero behavior change for direct `/ae:analyze BL-NNN` (when no `PRE_APPROVED_VALUES` block in spawn prompt). New behavior is opt-in via the orchestration loop.

### Why bundled

Both F-006 and F-007 are UX-friction-themed (theme: `ux-friction`) — one cohesive v0.9.5 release per CLAUDE.md "Versioning: intentional releases only" rule. F-006 lands the GTD-first canonical defaults that F-007's chained orchestration assumes; together they're the "AE 多干活, user 少填表" wave the session converged on.

### Discussions and follow-ups

- F-006 discussion: standalone plan (no `/ae:discuss` step) — direct `/ae:analyze` (multi-BL consolidation) → `/ae:plan` → `/ae:work` → `/ae:review` path
- F-007 discussion: `.ae/features/done/F-007-chaining-roadmap-to-analyze/discussions/001-chaining-design/` — Round 0 framing review went 4 REVISE → 4→1 topic collapse → APPROVED on attempt 2 + 1-round 3-agent council in lite mode
- BL-063 was originally bundled with BL-061+BL-062 in F-006 but split out at /ae:analyze stage — challenger + codex + gemini-via-oMLX 3-voice convergence said BL-063's orchestration surface was different blast radius from BL-061/062's text/logic edits
- BL-064 filed (`.ae/backlog/unscheduled/`): F-007 chain-execution L2 (live) coverage — when L2 governance infra (BL-056 scope or successor) exists. Codex ship-review Q3 surfaced the "AC4 deferral instruction won't survive ship handoff without an actual BL" concern.

### Closes

- F-006 (BL-061 + BL-062; closure review verdict: PASS, 2026-05-07; review caught 1 P1 + 4 P2, all squashed)
- F-007 (BL-063; closure review verdict: PASS, 2026-05-08; review caught 0 P1 + 4 P2, all squashed; 1 BL filed for L2 deferral)

## v0.9.4 — 2026-05-06

Two F-003 follow-ups ship together: F-004 (BL-055 dispatcher canonical-placeholder for /ae:plan + /ae:work) + F-005 (BL-057 library portability A0+ — actionable error messages on missing library + README cross-machine setup block).

### F-004 — Dispatcher canonical-placeholder (BL-055, content commit `92d8c55`)

- `plugins/ae/skills/agent-selection/SKILL.md`: canonical paragraph defining `<per agent-selection>` placeholder convention (BL-055-context section).
- `plugins/ae/skills/plan/SKILL.md`: line 218 `subagent_type: "architect"` → `"<per agent-selection>"` + inline annotation comment.
- `plugins/ae/skills/work/SKILL.md`: line 176 `subagent_type: "<dev-agent>"` → `"<per agent-selection>"` + dev-agent annotation; line 188 `subagent_type: "qa"` stays hardcoded (structural counterpart) with explicit annotation.
- New regression fixture: `plugins/ae/tests/{prompts,assertions}/plan-work-dispatcher-canonical-placeholder.md` (5 MUST + 2 MUST_NOT covering canonical placeholder + qa preservation + BL-058 trace-gate text).

**Behavioral change**: zero today (dispatcher resolves to architect/dev-agent under default conditions). **Capability change**: project_agents in pipeline.yml can now override the architect / dev-agent slots in /ae:plan + /ae:work; pre-F-004 the hardcoded values prevented override.

### F-005 — Library portability A0+ (BL-057, content commit `3e47de5`)

- `plugins/ae/skills/setup/SKILL.md`: 3 error-message edits at `--list` (line 130), `--add` (lines 165-166, new dir-level guard renumbers --add steps 9→10), `--sync` (line 273) — actionable hint ("See README \"Cross-machine setup\"") parallel to BL-059's `--suggest` actionable-exit pattern at line 317-321.
- `--list` and `--sync` preserve skip-and-continue semantics; `--add` REFUSES on missing library directory with rationale `--add modifies agent state, refusing prevents partial installs from an unavailable library`.
- `README.md`: new `## Cross-machine setup` section between `## Quick Start` and `## The Pipeline` — 2-step recovery flow (clone library at relative path; re-run AE command). Explicitly notes `--remove` is UNAFFECTED (does NOT propagate BL-057's factually-wrong claim).
- New regression fixture: `plugins/ae/tests/{prompts,assertions}/setup-library-missing-actionable-errors.md` (6 MUST + 3 MUST_NOT covering all 3 actionable patterns + 3 wrong-pattern bans).

**BC**: `--list`/`--sync` users see better error message text; `--add` users on missing library directory now get an explicit refuse with rationale (was vague "cannot compute content hash" at line 170).

### Why bundled

Both F-004 and F-005 are F-003 closure follow-ups (BL-055 + BL-057) — single coherent v0.9.4 release per CLAUDE.md "Versioning: intentional releases only" rule, mirroring F-003's own consolidated v0.9.3 release shape (which had its 3-version-bump rebase lesson earlier in the cycle).

### Discussions and follow-ups

- F-004 discussion: standalone plan (no /ae:discuss step) — direct /ae:analyze → /ae:plan → /ae:work → /ae:review path
- F-005 discussion: `.ae/features/active/F-005-library-portability-across-machines-lock/discussions/001-ship-path-choice/` — 4-agent council + 3 Doodlestein over 3 rounds + 5 framing-review reruns
- BL-060 filed (`.ae/backlog/unscheduled/`): `url:` field at `--library` time, trigger-gated (library count ≥3 OR multi-user OR >10min user-friction incident)
- Outcome B (mechanism — lockfile / auto-clone / cache-dir) unanimously rejected by F-005 council; preserved as future-BL territory if BL-060's trigger fires

### Closes

- F-004 (BL-055; closure review verdict: PASS, 2026-05-05)
- F-005 (BL-057; closure review verdict: pending /ae:review post-this-release)
- 5 framing-review reruns + 3 council rounds + 3 Doodlestein post-conclusion reviews + 4-grep verification gate before /ae:plan body — extensive process for ~30 LoC of A0+ ship; defensible because plan/work/setup are AE's most-used skills

## v0.9.3 — 2026-05-05

F-003 (BL-005 third-party agent integration) live validation + Layer 2 selection-trace observability — the full feature including its closure-review follow-ups (BL-058 emit-by-default wiring + BL-059 stub-path mechanical guard).

### Added — Layer 2 selection-trace observability

- `plugins/ae/skills/agent-selection/SKILL.md` Layer 2 trace format, symmetric to existing Layer 1, with 4 fields: `considered:` (candidate pool), `selected:` (winning agent + source enum: `project|user|builtin|library`), `rationale:` (one-line task-fit reason that names rejected candidates by name), `library-fallback:` (`fired|not-fired`).
- Trace surfaces: console stdout AND Team-lead synthesis report's `## Agent Selection Trace` section. **Default-ON, no flag required** (`--agent-debug` preserved as documented no-op alias for backward compat).

### Wiring — emit-by-default across all team-spawning skills (BL-058)

- `plugins/ae/skills/agent-teams/SKILL.md` Base Protocol gains a new `### Selection Trace Emission` subsection. Default-ON for all modes (Debate / Discussion / Investigation). Documents both surfaces and provides 3 mechanical verification grep patterns for `/ae:test-plugin`.
- 1-line forward-pointer added at each `TeamCreate` site in 8 consumer skills: `team`, `discuss`, `plan`, `work`, `review`, `analyze`, `consensus`, `test-plugin`. Skill-spec change only; 0 LOC change in test code.

### Added — `/ae:setup agents --suggest` mechanical falsification guard (BL-059)

- `plugins/ae/skills/setup/SKILL.md` `--suggest` Behavior section gains a new **Step 2: Source-path mechanical validation**. Before invoking Claude rubric, run `test -d "<resolved-source-path>"` via Bash for each `agent_libraries[]` entry:
  - Missing path → skip that library from candidate pool with explicit warning
  - All libraries missing → exit before Claude is called
- Path resolution: `source: "../foo"` resolves relative to project root; absolute paths used as-is (matches `--library` write-time rule).
- Mechanical pre-check, not LLM-judged. Closes the AC5/AC7 falsification debt F-003 validation report shipped with.

### Why

F-003 closed via `/ae:review` on 2026-05-05 with verdict PASS and 5 follow-up BLs (BL-055 thru BL-059). 4-of-4 reviewer convergence (architect, challenger, codex-proxy, gemini-proxy) flagged two P1 items that should ship with F-003 rather than as separate releases:

1. **BL-058**: v0.9.3's initial Layer 2 trace contract was emit-on-request only — users had to know `--agent-debug` flag or pass an explicit prompt instruction. The contract existed as documentation in `agent-selection/SKILL.md` but no consumer skill auto-emitted it. BL-058 wires emit-by-default into the universal anchor (`agent-teams/SKILL.md`) plus 8 consumer skills.
2. **BL-059**: AC5 ("no hallucinated agent names") and AC7 ("semantic stack-awareness") of the F-003 validation report were structurally LLM-self-graded — `/ae:setup agents --suggest` IS Claude, and the validation captured Claude's chat output. BL-059 adds a mechanical `test -d` guard that converts the gross "library doesn't exist" hallucination case from inferential to mechanical.

### Verification

- BL-058 wiring verified mechanically: `grep -rn "Selection Trace Emission" plugins/ae/skills/` returns 10 hits (anchor + 8 consumers + agent-selection clarification reference).
- BL-059 stub-path falsification test executed in AE repo on 2026-05-05: backed up `.claude/pipeline.yml`, stubbed `agent_libraries:` to `/this/path/does/not/exist/bl059-test`, invoked `/ae:setup agents --suggest --why`. Step 2 guard fired: emitted "library 'stub-nonexistent' source path missing" + "All configured agent_libraries[] sources are missing... Cannot proceed", exited before Claude rubric invocation. Restored pipeline.yml from backup.

### Known limit (residual)

AC5/AC7's "library exists but rubric selects unfit agents" case remains LLM-judged by design (per F-003 Decision 8 + challenger C2 limitation acknowledgment). BL-059 closes the gross-hallucination case structurally; the semantic-fit judgment continues to live in Claude's rubric, with `--why` rationale providing audit trail. Mechanical scoring was attempted and abandoned (`agent-selection-rubric.md:115-116` — "0/179, 0/185, 0/169 recommendations").

### Closes

- F-003 (live validation + closure)
- BL-058 (P1 elevated from P2 by F-003 closure review)
- BL-059 (P1 elevated from P2 by F-003 closure review)

## v0.9.2 — 2026-04-28

Plan 051 (F-002): path migration for `discuss/plan/work/review` skill outputs into per-feature directories. The 4 process skills now write inside `.ae/features/<state>/F-NNN-<slug>/` when a feature context is resolvable; legacy `.ae/{discussions,plans,reviews}/` remain valid for free-text invocations and untouched 175 pre-existing artifacts (Plan 050 known limit).

### Convention (single source of truth at `CLAUDE.md` → `## Project Management (GTD)` → `### Path-derived feature ID convention`)

- **Path-derived feature ID**: feature-resident plan/review/discussion artifacts derive `F-NNN` from their parent dir name (`.ae/features/<state>/F-NNN-<slug>/`). Optional `feature: F-NNN` frontmatter is validation-only — readers warn on path/frontmatter mismatch, path always wins.
- **Path classes distinction**: `.ae/features/{active,done,abandoned}/` is fixed AE internal state (not configurable); `output.{plans,reviews,discussions,milestones,backlog,analyses}` are configurable legacy/customization paths.
- **Reader union scan**: `ae:dashboard`, `ae:next`, `ae:retrospect`, `ae:plugin-stats`, `ae:plan-review` scan BOTH legacy and feature-dir locations and union the results — no surface-index pointer files (eliminates dual-write debt; readers, not writers, bridge the two locations).

### Writer skills (4)

- `ae:plan` Step 2 defines the canonical **Feature context resolution** rule (4-form: promoted BL / discussion-dir path / free-text title-overlap / legacy fallback). Feature dir resolved → write `<feature-dir>/plan.md`; otherwise legacy `output.plans/NNN-slug.md`.
- `ae:work` Argument Inference unions both plan locations. New **Milestone path resolution** helper section centralizes the feature-dir vs legacy `step-summaries.md` / `notes.md` path logic — referenced from 5 sites (Step-Summary Context, Deferred Items, Defer-write, Step Summary persistence, Doodlestein checkpoint).
- `ae:review` Argument Inference unions both plan locations; Output writes `<feature-dir>/review.md` (no surface pointer); Check 4 milestone-notes path tracks the feature-dir vs legacy split; Completion Invariant Phase 1 simplified from 5 steps to 3 (path-derive → frontmatter bridge → manual fallback; deleted Plan 050 best-effort scan + ambiguous-match steps).
- `ae:discuss` Step 1 Setup REFERENCES the Feature context resolution rule (does not restate). Optional `feature: F-NNN` on discussion `index.md` is path-derived; readers flag mismatch via staleness rule.

### Reader skills (5)

- `ae:dashboard`: Plan-linkage rule simplified (drops speculative scan-by-filename). Plans + Reviews now union-scan both locations; tiebreaker is most recent `created:`.
- `ae:next`: Step 0 + Step 8 union both plan and review locations.
- `ae:retrospect`: Review-file lookup unions feature-dir `<feature-dir>/review.md` and legacy `output.reviews/*.md`.
- `ae:plugin-stats`: Outcome-stats scan unions both review locations.
- `ae:plan-review`: Argument inference unions both plan locations.

### Other updates

- `CLAUDE.md`: new **Path classes** section + **Path-derived feature ID convention** section. `.gitignore` policy clarified (existing `.ae/` covers feature dirs; no per-subdir overrides).
- `plugins/ae/templates/pipeline.template.yml`: 13-line header note for external projects explaining the two path classes.
- `ae:code-review`: Track 4 staging stays at `<output.reviews>/per-commit/` (implementation detail); user-visible review files for feature-dir plans land at sibling `review.md`.
- `ae:analyze`: documents that subsequent discuss/plan/review outputs land inside the feature dir.
- 6 test fixtures updated for path-derive write target + union-scan argument inference.

### Known limits (accepted)

- **Argument-inference union scan cost**: ae:work and ae:review scan both locations. Under 100 file stats at typical scale; if perf becomes an issue, cache layer or single canonical location replaces the union.
- **No legacy artifact migration**: 175 pre-existing `.ae/{discussions,plans,reviews}/` files stay where they are (Plan 050 explicit decision). Legacy artifacts age out naturally as the next 100-feature epoch goes through feature dirs.
- **ae:work bootstrap**: Step 2 modified ae:work's own SKILL.md; the active /ae:work session used cached pre-edit version. New behavior takes effect after `/plugin install` or Claude Code restart.
- **External-project bootstrap (deferred)**: this plan assumes `.ae/features/{active,done,abandoned}/` exists. Adding `/ae:setup` directory scaffolding is out of scope; tracked as follow-up backlog item.
- **Discussion frontmatter `feature_completed:`**: out of scope for this plan; revisit in follow-up if needed.

### Process

- F-002 dogfooded **partially** through the GTD model. Plan file at `.ae/features/active/F-002-path-migration/plan.md`; step-summaries at `.ae/features/active/F-002-path-migration/milestones/step-summaries.md` (in-feature-dir milestone path — first dogfood of Step 2's milestone resolution). Of the 5 AC7 live-test scenarios, only `/ae:review` zero-arg union scan was actually exercised post-cache-refresh; the other 4 (`/ae:plan` against promoted/unpromoted BL, `/ae:work` zero-arg, `/ae:dashboard`) remain user-driven future verification — not yet exercised against the new cached SKILL.md. The `/ae:work` execution session itself ran on the **pre-Step-2** cached version (documented bootstrap constraint), so it does not count as a new-behavior dogfood.
- /ae:plan-review caught 6+ Must Fix items across 4 reviewers (architect + dependency-analyst + codex-proxy + gemini-via-oMLX-fallback). Notable findings: drop surface-pointer file (3-of-4 reviewer convergence — eliminates dual-write debt); path-derive feature ID instead of mandatory frontmatter (Codex MF-2 — drift-prone); ae:review Argument Inference + Check 4 milestone-path silently broken without explicit fixes (architect MF-3, MF-4); CLAUDE.md schema location wrong (Codex MF-3); ae:next scope mischaracterized (Codex MF-5).
- User mid-execution flagged a missing scope: documentation migration. Step 6 expanded to cover 7 reader skills + CLAUDE.md path-class + pipeline template + 27 test fixtures (per-file triage).
- Gemini MCP returned 503 (high demand) during plan-review; TL fell back to local oMLX `gemma-4-26b-a4b-it-4bit` to preserve Google-family lens per CLAUDE.md fallback protocol.

## v0.9.1 — 2026-04-28

Plan 052 (F-001 / BL-051): skills proactively use Claude Code Task APIs (`TaskCreate` / `TaskUpdate`) for step progress tracking. The persistent task panel above the prompt now reflects which phase a multi-step skill is in, transitioning through `pending → in_progress → completed` per phase boundary. Convention complements (does not replace) the durable per-step `step-summaries.md` artifact (Plan 049) — tasks are conversation-scoped, step-summaries are cross-session.

### Convention (single source of truth at `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`)

- **Canonical phase IDs**: `Pre-check` (singular), `Step N`, `Phase N`, `TDD Cycle`, review-track names verbatim. Subject format: `"<skill-name>: <phase-id>"`.
- **Per-skill task list (static, design-time)**: ae:work = 1 + N (plan-dependent), ae:plan = 6, ae:review = 5, ae:analyze = 4, ae:discuss = 8, ae:test-plugin = 4.
- **Lifecycle**: batch-create at skill start (defer plan-dependent dispatch until Pre-check Check 2 reads the plan), `in_progress` immediately before first observable action, `completed` only when phase satisfies its completion criterion (per-phase table). Mid-plan resume: create all tasks, immediately mark `[x]`-completed steps as `completed`.
- **Per-phase completion criteria**: Pre-check = all checks pass; ae:work Step N = `git commit` returned 0; ae:review review-tracks = findings received at TL via SendMessage; ae:analyze Mode A = promote complete; etc.
- **Owner field**: omit for self-tracking tasks (not for claim by other agents). Documented fallback to `skill:<name>` if a future Claude Code update enforces `owner` on `TaskUpdate`.
- **On error**: leave in-flight tasks at `in_progress` so user sees where execution stopped. Allowed status enum: `pending | in_progress | completed | deleted` only.
- **Sub-actions deliberately excluded**: TDD sub-cycles (write/red/implement/green/refactor), individual Pre-commit Checks A-G, individual Pre-check sub-checks (Check 1-5), per-phase sub-actions in ae:review (Synthesis / Fixup / Outcome Statistics / Output / Knowledge Capture / Completion Invariant), Steps 4-6 + 10 in ae:discuss.

### Skills updated (6 multi-step skills)

- `ae:work`: 1 Pre-check task + N step tasks (plan-dependent dispatch after Check 2). TaskUpdate at TDD start (`in_progress`) and Post-commit (`completed` after `git rev-parse --verify HEAD` succeeds).
- `ae:plan`: 6 tasks at skill start (Pre-check + Step 1-5). With `--skip-review`: Steps 3+4 transition `pending → completed` directly.
- `ae:review`: 5 tasks (Pre-check + 4 review tracks `Security review` / `Performance review` / `Architecture review` / `Cross-family challenge + synthesis`). Existing 4-track cluster preserved with canonical subject format. Per-track `in_progress` at reviewer spawn; `completed` when findings arrive at TL.
- `ae:analyze`: 4 tasks (Pre-check + Mode A or B + Research + Synthesize). Mode task created post-selection (mutually exclusive A/B).
- `ae:discuss`: 8 tasks (Pre-check + Step 1 Setup + Step 1.5 Round 0 + Step 2 Spawn + Step 3 Discussion + Step 7 Sweep + Step 8 Conclusion + Step 9 Doodlestein).
- `ae:test-plugin`: 4 tasks (Pre-check + Phase 1 + Phase 2 + Phase 3).

### Known limits (accepted)

- Auto-compact panel-freeze risk for long skills (10+ phase transitions in one run): underlying state remains consistent, only rendering may freeze.
- Latency cost: ~100-500ms per `TaskCreate`/`TaskUpdate` call. A 5-step ae:work cycle = ~15 writes ≈ 1.5-7.5s overhead. Accepted for steps over a few seconds.
- Coupling between SKILL.md phase structure and task subjects: renaming a phase requires updating its task ID. Bounded by review process; reopen trigger if 3+ phase renames per sprint.
- Concurrent skill runs with same subject (e.g., 2 parallel `/ae:work` Pre-checks) are visible separately in the panel because task IDs disambiguate; subjects do not. If panel readability degrades materially under sustained 3+ concurrency, follow-on BL.
- `owner=null` semantics depend on Claude Code Task API contract for self-tracking tasks. Documented fallback to `skill:<name>` if API enforces non-null `owner` on `TaskUpdate`.

### Process

- F-001 was the first feature dogfooded end-to-end through the new GTD model (BL-051 → ae:analyze promote → ae:discuss [cancelled, over-engineered] → ae:plan → ae:plan-review → ae:work). The plan file lives at `.ae/features/active/F-001-skills-proactively-use-taskcreate-api-to/plan.md` (in feature dir directly, ahead of Plan 051's path migration).
- Plan ID 052 (not 051): Plan 050's known-limits reserved 051 for the path-migration plan that systematizes putting plan files in feature dirs.
- /ae:plan-review caught 6 Must Fix items (cache-refresh dependency, ae:review double-counting, owner-field semantics, subject ambiguity, runtime-time-estimation drift, error-state enforcement); all applied as inline plan revisions before /ae:work.
- During /ae:work execution, the very feature being built was dogfooded — the `/ae:work` invocation used `TaskCreate` / `TaskUpdate` per the convention being shipped. Live demo of the panel rendering through 5 steps.

## v0.9.0 — 2026-04-28

GTD-aligned project management model. Plan 050 maps AE skills to GTD's 5+1 phases (Capture / Clarify / Organize / Reflect short-cycle / Reflect long-cycle / Engage / Archive — plus an AE-self-development sidebar for plugin delivery metrics). Supersedes Discussion 052's heavier proposal (kind: enum, ae:triage skill, threshold-based Task primitive, Liquibase schema.md, Tier 0/1/2/3 migration — all rejected as over-engineered for solo-dev self-use).

### New skills (2)

- **`/ae:backlog`** (GTD Capture) — frictionless one-line inbox drop. `/ae:backlog <description>` writes a stub `BL-NNN-slug.md` to `.ae/backlog/unscheduled/` with minimal frontmatter (`id` / `title` / `created` / `status: open`). No prompts, no classification — that's the Clarify phase's job. Slugification uses a deterministic 7-step sequence (lowercase → strip non-ASCII → non-alphanumeric runs → trim → 40-char right-cut → re-trim → empty fallback to bare `BL-NNN.md`); order is load-bearing so multiple LLM agents produce the same slug for the same input.
- **`/ae:plugin-stats`** (AE plugin self-development outcome stats) — receives the old `ae:retrospect` parser + 23 historical review records. Reads `.ae/reviews/*` for rework rate / P1 escape / drift / fix-loop / auto-pass metrics. Backward-compat reads legacy `type: retrospect` reports as input. Independent of project-level GTD retrospect (delivery metrics ≠ product retrospective; matches OpenAI evals + Google DORA/Four Keys split).

### Rewritten skills (3)

- **`/ae:roadmap`** — full rewrite from sprint/version-grouped model to GTD Clarify (591 → ~210 lines after fixups). Surfaces 4 sections in one read-only pass: (a) **Promote candidates** — LLM-judged PROMOTE/WAIT verdicts on backlog BLs (default WAIT, deterministic sort, thin-BL fallback to "insufficient info; flesh out"); (b) **Dependency analysis** — 5-column table with `ready? = YES/NO/CYCLE`, plus deadlock/critical-path/orphan signals; (c) **Sizing aggregate** — T-shirt counts (XS/S/M/L/XL) + estimated effort range + unsized list; (d) **Archive prompt** — surfaces roadmaps with all linked features done (scans `features/{active,done,abandoned}/`) plus orphan-link warnings. Removed: sprint primitives (plan/close/move/add/remove subcommands, `v<X>.<Y>.<Z>/` schema), `--gaps` validator, R2 release-readiness flag, WIP overload warnings — all per Plan 050 Non-goals. Legacy `.ae/roadmaps/v*.md` files stay on disk; `--legacy` flag surfaces them informationally only (anti-poisoning rule prevents legacy `## Items` tables leaking into candidate reasoning).
- **`/ae:retrospect`** — repositioned from AE-plugin outcome stats to **project-level long-cycle Reflect** (GTD Weekly Review style). Reads `.ae/features/done/` within `--since` window (default 4 weeks). 4 conversational sections: Recently shipped / Lessons learned (cite-evidence discipline; honest "no notable lessons" beats forced bullets) / Estimate vs actual (T-shirt vs elapsed-days, notes wall-clock-vs-active-time gap) / Next promote candidates. **Conversational output only — no file written** (Reflect is for reading; user decides what to capture).
- **`/ae:analyze`** — extended with **promote BL → feature dir** behavior (Mode A) alongside existing free-text mode (Mode B). Mode A pre-check defends against double-promote (hard refuse on active/done; soft refuse on abandoned). Promote flow: F-NNN allocation independent of BL ID → mv BL into feature dir as bare `BL-NNN.md` → BL frontmatter writeback (`status: promoted` + `promoted: <date>` + `promoted_to: F-NNN`) → create feature `index.md` (frontmatter schema deferred to CLAUDE.md as single source of truth) → T-shirt `size:` + `depends_on:` advisory propose (existing values always win; re-propose only via `/ae:roadmap --resize`). Documented manual recovery flow for undoing a promote.

### Updated skills (3)

- **`/ae:dashboard`** — primary read source switches to `.ae/features/active/*/index.md`. Feature stage detection mapped to lifecycle (analyzing → discussing → awaiting plan → ready for work → work in progress → awaiting review → review failed → done). `--all` flag includes done + abandoned subdirs (each in its own table). `--legacy` flag surfaces `.ae/discussions/`, `.ae/plans/`, `.ae/reviews/` in a separate section below the feature table; default hides legacy artifacts (most are terminal-state, mixing creates permanent noise). Empty-state nudge guides first-run users: when `features/active/` is empty AND backlog has items → suggest `/ae:roadmap`; when both empty → suggest `/ae:backlog`.
- **`/ae:next`** — new Step 0 (GTD primary path) checks `features/active/` for actionable plans first. Cold-start Step 2 now leads with GTD entry points (`/ae:backlog` / `/ae:roadmap` / `/ae:analyze`) before listing the legacy direct pipeline. Step 11 (all complete) updated to suggest `/ae:roadmap` / `/ae:backlog` / `/ae:retrospect` / `/ae:plugin-stats`. Steps 1–10 preserved verbatim as legacy/cold-start fallback (handle pre-Plan-050 projects).
- **`/ae:review`** — Completion Invariant adds feature-level archive trigger: when `verdict: pass` AND target plan's feature dir is in `features/active/`, mv to `features/done/` + set `status: done` + `done: <date>` in `index.md` + best-effort roadmap row update. Two-phase split (Locate → Execute) with explicit STOP semantics on no-match. Plan 050 transition window (before Plan 051's `feature: F-NNN` plan frontmatter ships) → fallback chain ends with explicit "📦 Manual archive required:" message listing actual candidate dirs from `ls .ae/features/active/`. Documented manual recovery flow for undoing an archive.

### CLAUDE.md additions

- New `## Project Management (GTD)` section — single source of truth for the GTD phase mapping table, `.ae/features/F-NNN-slug/` directory layout, and the feature `index.md` frontmatter schema (required: `id` / `title` / `status` / `created`; optional GTD-related: `theme` / `roadmap` / `size` / `depends_on` / `origin_bl` / `done` / `abandoned` / `abandoned_reason`; user-defined fields tolerated as metadata-only).
- **Reader contract**: 6 explicit rules covering unknown fields (silent ignore), unknown enum values on known fields (warn + skip from enum-dependent workflows, no silent coerce), missing optional fields (graceful default), missing required fields (log error + skip record + continue), list-or-scalar normalization (`origin_bl` / `depends_on`), and the `(unthemed)` bucket convention for missing `theme` (uniform across skills, never invented from title/body).
- Schema evolution rule: update CLAUDE.md AND consuming SKILL.md files. No Liquibase versioning, no separate `schema.md` file (intentional simplification).
- Legacy artifacts policy: 175 pre-existing `.ae/discussions/`, `.ae/plans/`, `.ae/reviews/` artifacts stay where they are; new work goes through `.ae/features/`.

### Test infrastructure

- 5 `retrospect-*.md` test pairs migrated to `plugin-stats-*.md` (target + invocation refs updated). Preserves coverage of the inherited Outcome Statistics behavior on the new skill name.
- New `retrospect-empty-features-done` test pair covers the GTD reflect's empty-window message + no-file-written invariant + `/ae:plugin-stats` redirect.

### Known limits (by design)

- **Partial archive** during the Plan 050 → Plan 051 window: `discuss/plan/work/review` skill outputs still write to legacy paths (`.ae/discussions/`, `.ae/plans/`, `.ae/reviews/`); only `BL-NNN.md` + `index.md` + `analysis.md` live in the feature dir at archive time. Cross-references resolve via frontmatter `id:` (path-independent). Plan 051 will systematically migrate path layouts.
- **No mechanical schema enforcement.** Reader-tolerant contract avoids hard gates; silent skip on unknown enum values is the trade-off. Concrete reopen triggers are recorded in `.ae/milestones/050/notes.md` (BL-023/024-class misclassification incident, etc.).
- **`mv` operations are not high-reversibility.** Promote (BL → feature dir) and archive (feature/active → feature/done) are documented with explicit manual recovery flows.

### Process notes

- Plan 050 is the AE-on-AE self-bootstrapping execution of Plan 050. 10 commits over 1 day. 5-track `/ae:review` (architecture-reviewer, code-reviewer, challenger, codex-proxy, gemini-proxy) → 8 P2 fixups applied → verdict pass. Gemini API quota exhausted during accumulated checkpoints; oMLX gemma-4 fallback succeeded (cross-family complete).
- Discussion 052 conclusion explicitly marked SUPERSEDED in its frontmatter; the original 16 decisions are preserved as audit-trail / lessons-learned about over-engineering risk in self-use tool design.

## v0.8.3 — 2026-04-18

Cache-refresh bump. In-flight content carried so local plugin reinstall picks up BL-005 Phase 1 (third-party agent integration) specs — not yet validated in dogfood. BL-036 tracks post-dogfood tuning revision.

### In-flight content carried by this bump

BL-005 Phase 1 — library-to-project agent curation (6/7 plan 041 steps committed; Step 7 Mengdie dogfood deferred to user session):

- **`docs/references/agent-contract.md`** (new) — canonical 3-tier frontmatter contract (REQUIRED `name`/`description`; RECOMMENDED `role`/`tools`/`model`/`tech_stack`/`specialty`; TOLERATED `color`/`emoji`/`vibe`/unknown). Documents CC filename-stem spawn resolution and AE no-normalize-on-import rule.
- **`docs/references/agent-selection-scorer.md`** (new in v0.8.3, **superseded in Phase 2** — replaced by `plugins/ae/skills/setup/agent-selection-rubric.md` after Phase 2 validation showed the 6-signal math collapsed on real-project corpora. The deprecated spec remains archived as `plugins/ae/skills/setup/agent-selection-scorer.md.deprecated` for reference.)
- **`docs/references/agent-governance-format.md`** (new) — `.claude/agent-governance.md` YAML rule schema (`agent`, `action: force|prefer`, `context`, `scope`, `added_at`, `added_reason`). Documents platform-decoupling (AE reads governance file directly; `@include` in CLAUDE.md is user-visibility only).
- **`plugins/ae/templates/pipeline.template.yml`** — added `agent_libraries:` array + extended `project_agents[]` with `source`, `source_sha`, `display_name`, `priority`, `required`, `tech_stack`, `specialty`.
- **`plugins/ae/skills/setup/SKILL.md`** — new `agents` subcommand section: `--library`, `--list`, `--add --reason`, `--remove`, `--sync`, `--detach`, `--suggest --phase --why`, `--refresh`, governance bootstrap flow, pattern-detection triggers (Trigger A: --add rationale; Trigger B: 3-consecutive-spawn), `--rule-cleanup`.
- **`plugins/ae/skills/agent-selection/SKILL.md`** — Rule 4 rewritten as 3-layer short-circuit chain (Layer 1 CLAUDE.md rules → Layer 2 Claude semantic selection via agent-selection-rubric.md → Layer 3 user one-pick). **v0.8.3 initially shipped a Layer 2 6-signal deterministic scorer; Phase 2 validation replaced it with LLM-based rubric.**
- **`docs/decisions/037-agent-contract.md`** — superseded notice pointing to the three new canonical reference docs.

Phase 1 is SPEC-only until:
- Mengdie dogfood (plan 041 Step 7) surfaces tuning targets for BL-036
- Phase 2 Layer-2 behavioral test verifies Rule 4 runtime execution (conclusion 040 T5 gate)

## v0.8.2 — 2026-04-16

Cache-refresh bump. Not a formal release — accumulates in-flight changes so local plugin reinstall picks up the new ae:roadmap v2 spec. Full release notes will land in a future version bump when Phase C (velocity math) ships.

### In-flight content carried by this bump
- BL-024 Doodlestein Bash permission removed
- BL-030 ae:plan hardcoded `docs/backlog/` replaced with `output.backlog/`
- ae:roadmap v2 Phase A: migration + path-aware reading + `plan`/`close` subcommands + schema invariants
- ae:roadmap v2 Phase B: `move`/`add`/`remove`/`size` CRUD + `--gaps` structural validator + flow-health signals (WIP + age) + R2 structural release-readiness flag + canonical `## Notes` action enum

## v0.8.1 — 2026-04-15

### Housekeeping

- **ae:retrospect**: Replace 7 Chinese error strings with English equivalents
- **ae:analyze**: Rename "Second Brain" → "Mengdie" in Step 3.5 header and template
- **model-effort-matrix.md**: Remove stale `simplicity-reviewer` row (agent deleted in v0.8.0)
- **ae:plan**: Add consequence note after `--skip-review` — plan stays `status: draft`
- **docs/quickstart.md**: Reorder prerequisites (Agent Teams first); add Claude-only framing and cross-family unavailable output; add P1/P2/P3 severity glossary; reposition `/ae:next` as primary navigation; add `/ae:discuss` callout
- **README.md**: Reorder prerequisites to match quickstart; fix Agent Teams description (hard-block vs fallback); add argument to `/ae:plan` example
- **BL-023**: Confirmed `hooks.json` not auto-registered by plugin system; remove dead `cross-family-status.json` write from `check-cross-family.sh`

## v0.8.0 — 2026-04-15

### Theme: Adoption Readiness

First release focused on external users. The core pipeline (discuss→plan→work→review) is mature; this release makes it accessible.

### New Features
- **README Rewrite**: Problem-first framing, "Who is this for?" section, commands grouped by user journey (First Run → Daily Use → Analysis → Ops). Agent Teams prerequisite moved to Quick Start.
- **Quickstart Guide** (`docs/quickstart.md`): End-to-end tutorial (install → setup → plan → work → review) using "add rate limiting to Express API" as the concrete example. Expected output at each stage. Troubleshooting for the 3 most common failures.
- **Agent Contract Specification** (`docs/decisions/037-agent-contract.md`): Defines what makes an agent AE-compatible — required frontmatter, role inference from description keywords, role-to-slot mapping, discovery path, precedence rules.
- **Agent Authoring Guide** (`docs/agent-authoring.md`): How to write a project agent — minimum viable example, role taxonomy, testing with `/ae:team`, pipeline.yml override.
- **Agent Templates**: `plugins/ae/templates/agent-template.md` + 2 examples (security-auditor, api-expert) in `plugins/ae/templates/examples/`.
- **pipeline.yml `project_agents` Schema**: Optional section for explicit role assignment or agents outside `.claude/agents/`. Commented out by default in template.
- **agent-selection Rule 4 Implementation**: Concrete discovery logic — scan `.claude/agents/*.md`, read pipeline.yml `project_agents`, infer role from description keywords, map to team slots. Project agents preferred over built-in.
- **ae:code-review Track 1 Alignment**: Track 1 now checks `project_agents` in pipeline.yml for reviewer-role entries (previously only scanned `.claude/agents/`).

### Improvements
- **ae:setup**: Initialize mode aligns with agent contract spec for role inference. Update mode detects new project agents since last setup.
- **ae:team**: Discovery rule aligned with agent-selection Rule 4 (single source of truth).

### Housekeeping (pre-v0.8.0)
- Discussions 033 + 036 closed (status: active → done)
- README counts fixed (17→20 skills, 17→16 agents)
- Zombie `simplicity-reviewer.md` deleted (17→16 agents)
- BL-015 closed (done), BL-016 closed (acceptable as-is)
- BL-005 promoted to P1 (Scope B), BL-009 demoted to P2
- New backlog: BL-022 (P1 onboarding), BL-023 (P2 hooks gap)

### Test Suite
- 5 new L1 tests: agent discovery, ae:setup detection, pipeline routing, role-slot mapping, backwards compatibility
- Updated `team-project-agents-priority` L2 test: `agents:` → `project_agents:` key (both prompt and assertion)
- Total: 118 test pairs (5 new L1 + 1 updated L2)

### Stats
- 20 skills, 16 agents, 118 test pairs, 2 MCP servers, 1 hook

## v0.7.0 — 2026-04-05

### New Features
- **Step-Summary Artifact**: ae:work post-commit writes persistent 4-field step summary (Decisions/Rejected/Cross-step deps/Actual files) to `<milestones>/<plan-id>/step-summaries.md`. TL reads last 3 blocks at Check 2 for context recovery across long features.
- **Context Overlap Heuristic**: ae:work compares previous step's actual files with current step's expected files. File overlap triggers injection of prior step summary into dev agent spawn prompt. QA gets fresh eyes (no injection).
- **run_in_background Detection**: ae:work Check 3 verifies Agent tool schema via ToolSearch before spawning teams. Fail-open when unavailable. Doodlestein checkpoint respects cached result.
- **Deferred Findings Accountability**: Structured `DEFERRED [Step N]:` format with mandatory Reason field replaces free-form notes.md. Check 4 surfaces due items with required disposition (FIXED/STILL-DEFERRED/WAIVED). ae:review Check 4 audits all deferred items — hard block on silent drops.
- **Smart Model Selection**: Per-skill effort gradient (5 high, 7 medium, 7 inherit). Doodlestein agents pinned to `model: sonnet, effort: medium`. Model-effort matrix reference doc.

### Improvements
- **Proxy Quota Fallback**: Gemini/Codex proxies now report quota exhaustion to TL and STOP instead of self-fallbacking to Sonnet. TL decides fallback per CLAUDE.md strategy.
- **Feature-scoped notes.md**: All milestone notes paths changed from glob to `<milestones>/<plan-id>/notes.md`. Doodlestein uses `CHECKPOINT:` prefix to avoid triggering Check 4 parsing.
- **Auto-pass Gate**: Added `deferred_resolved` condition — Check 4 dispositions must be written before auto-continue.
- **Backlog Cleanup**: 26 → 8 items (6 resolved, 9 closed as low-ROI, 2 moved to feature branches, 1 fixed inline).

## v0.6.2 — 2026-04-05

### Bug Fixes
- **ae:test-plugin**: artifact collection protocol missing file content snapshots — `[file:contains]` assertions need content, not just filenames (P2 from review)
- **test-lead**: Output Format verdict examples missing `method` field, inconsistent with Phase 4 schema
- **ae:dashboard**: plan `status: done` now treated as "done" directly — no longer requires a review file (fixes false "awaiting review" for pre-review features)
- **plugin.json**: add `title` fields to userConfig, fix outputStyles path format (object → string)
- **Test frontmatter**: 5 prompt files used `skill:` instead of `target:` — standardized

### Test Suite
- ae:test-plugin test suite regenerated: 8 → 21 cases (15 Layer 1 + 6 Layer 2)
- Layer 2 cases cover Class B execution (TeamDelete/rebuild, test-lead resurrection, artifact collection, orphan cleanup, --refresh deletion, report persistence)
- All 21 cases verified: L1 15/15 PASS, L2 6/6 PASS

### Pipeline State
- 17 discussion frontmatter inconsistencies fixed (pipeline.* fields, plan path links)
- Batch reconciliation of historical discussions predating Completion Invariant

## v0.6.1 — 2026-04-05

### Bug Fixes
- **All 12 skills**: pre-check field corrected from `experiments` → `env` (CC reads `settings.json → env`, not `experiments`)
- **ae:discuss**: add missing Agent Teams pre-check (was the only Teams-dependent skill without one)
- **ae:work**: remove broken git push PreToolUse hook (CC hooks match tool name only, cannot filter by command content)
- **ae:analyze**: add missing pipeline.yml pre-check
- **check-cross-family.sh**: fix jq path and remediation message to use `env` block
- **README**: fix settings.json example (`env` not `experiments`), update command count (12/17)

### Test Suite
- 30 new test cases: ae:analyze (6 L1 + 3 L2), ae:work (4 L1), ae:discuss (5 L1)
- Test naming convention standardized: descriptive slugs, filename matches `id:` field
- 11 TC-format assertion files migrated to slug format (atomic rename)

## v0.6.0 — 2026-04-04

### CC Capability Uplift (Plans 024-025)

#### P0: Agent/Skill Frontmatter
- **All 17 agents**: `color` by role group (research=blue, workflow=green, review=yellow, doodlestein=red, proxy=purple)
- **All 17 agents**: `effort` tiering (high/medium/low by role)
- **All 17 agents**: `maxTurns` protection (conservative-high values)
- **5 agents**: `omitClaudeMd: true` for proxy + Doodlestein agents (~1000 tokens saved per spawn)
- **All 17 skills**: `user-invocable` field audit (fixed underscore → hyphen)
- **codex-proxy, gemini-proxy**: `model: haiku` (validated — quality indistinguishable from Sonnet, ~10x cost reduction)

#### P1: Config
- **plugin.json**: `userConfig` with 2 keys (gemini_flash_model, gemini_pro_model)
- **plugin.json**: `outputStyles` — ae-structured + ae-compact
- **Gemini MCP**: FALLBACK_MODEL reads from `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL` env var
- **Gemini MCP**: `alwaysLoad` annotation on chat/reply tools (skip ToolSearch overhead)

#### P1: Docs
- **docs/references/claude-code-plugin-api.md**: stable API reference (~200 lines) — frontmatter fields, hooks, security boundaries, feature flags, token budgets
- **docs/decisions/021-claude-code-source-analysis-conclusion.md**: decision record with moat definition, risk register, agent override mechanism

#### P1: Agents
- **4 agents**: `skills` preload (qa→ae:code-review, architect→ae:agent-teams+ae:agent-selection, challenger→ae:agent-teams, test-lead→ae:test-plugin)
- **cross-family-review.md**: canonical MCP tool name reference header
- **test-plugin/SKILL.md**: worktree memory isolation instruction

### Component counts
- 17 skills, 17 agents, 2 MCP servers, 2 output styles, 2 hooks

## v0.5.0 — 2026-04-04

### test-plugin Layer 2: Real Execution (Plan 022)
- **test-plugin/SKILL.md**: Phase 1.3 rewrite — writers shutdown, test-lead stays alive, no unconditional TeamDelete
- **test-plugin/SKILL.md**: Prompt/assertion file split — `tests/prompts/` and `tests/assertions/` for structural blind protocol isolation
- **test-plugin/SKILL.md**: Phase 2 unified git worktree isolation for both Class A and B
- **test-plugin/SKILL.md**: Class B team rebuild — one TeamCreate with skill agents + resurrected test-lead (reads assertions from main repo path)
- **test-lead.md**: Resurrection Protocol — context recovery from files, judge by assertion text only
- **work/SKILL.md**: C.5 delegates to `/ae:test-plugin --regression --layer1` instead of inline logic
- **test-plugin/SKILL.md**: `--layer1` flag for Layer 1-only execution (used by C.5)
- 46 existing test cases migrated to split format, 13 new ae:team test cases generated

### Doodlestein Review Pipeline (Plan 023)
- **code-review/SKILL.md**: Track 4 — per-commit Doodlestein adversarial challenge (sonnet, 1 combined agent, full mode only)
- **work/SKILL.md**: Accumulated Doodlestein checkpoint — mid-feature (floor(total/2) for plans >5 steps) + final step (plans >=3 steps), Codex/Gemini proxy, P1 injects into auto-pass gate

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — skill enhancements only)

## v0.4.2 — 2026-04-03

### Usage Insights — Pipeline Hardening
- **work/SKILL.md**: Check 1 scans pending steps for missing "Expected files:" and warns upfront (mentions hard-stop at Check B)
- **work/SKILL.md**: UNKNOWN drift upgraded from soft pause to hard stop with 3 explicit recovery options (add Expected files / confirm as unknown / rollback)
- **work/SKILL.md**: Post-commit gate description updated — UNKNOWN no longer reaches gate (blocked at Check B)
- **review/SKILL.md**: Outcome Statistics adds `Fix loop triggers` metric + `unknown` category to Drift events

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — pipeline hardening only)

## v0.4.1 — 2026-04-02

### Bug Fixes — External Review P1/P2
- **plugin.json**: register codex + gemini MCP servers (was `mcpServers: {}`, contradicting bundled claim)
- **architect.md**: remove dead `SendMessage to simplicity-reviewer` reference (P1 — would hang or no-op)
- **challenger.md**: rename Step 4 "Synthesize" → "Aggregate and Report" (TL-synthesis protocol consistency)
- **challenger.md**: add YAGNI to Attack Surface Reference (replaces simplicity-reviewer's role via challenger's existing constraint framework)
- **qa.md**: replace direct MCP tool calls with proxy agent SendMessage + 120s timeout protocol
- **agent-selection/SKILL.md**: add missing `name: ae:agent-selection` frontmatter field

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — bug fixes only)

## v0.4.0 — 2026-04-02

### Agent Teams Protocol Unification
- **New skill**: `/ae:agent-teams` — unified protocol for all Agent Teams (Base layer + Debate Mode + Investigation Mode + Doodlestein Protocol)
- **TL synthesizes everywhere**: all 9 agent-teams skills updated — TL (Session TL) is the sole synthesizer, agents research/challenge/report but never produce final output
- **Challenger = pure opposition**: ae:review and ae:analyze challenger no longer synthesizes, TL merges findings
- **ae:consensus rewrite**: TL acts as mediator directly (no more mediator agent), simplicity-reviewer removed
- **ae:discuss rewrite**: Discussion Mode per agent-teams protocol, UAG (Unanimous Agreement Gate), 3 Doodlestein agents, consensus verification
- **3 new agents**: `doodlestein-strategic`, `doodlestein-adversarial`, `doodlestein-regret` — cross-family challenge layer

### ae:test-plugin v2 — Blind Execution + LLM Judge
- **Blind execution model**: test-lead generates+judges, Session TL executes without seeing assertions (behavioral contract, prevents self-easy-test bias)
- **LLM-as-judge**: configurable judge (`test_plugin.judge` in pipeline.yml) — codex (default), gemini, or claude
- **Persistence**: test cases saved with `source: generated|manual|regression` frontmatter tags
- **Flags**: `--verbose` (debug), `--regression` (run existing only), `--refresh` (regenerate generated cases)
- **Judge health check**: pre-check verifies judge reachability before Phase 2
- **Verdict protocol**: structured `{ verdict, assertion, reasoning }` format, per-assertion granularity
- **test-lead expanded**: Phase 4 judge integration, source tagging, MCP tool routing

### Other changes
- **pipeline.yml**: new `test_plugin.judge` config section
- **ae:setup**: documents test_plugin config in Output Defaults table
- **ae:retrospect**: filters `type: test-report` documents (only processes `type: review`)
- **Existing test cases**: migrated with `source: manual` frontmatter
- **simplicity-reviewer**: removed from all skill references and agent-selection table (agent file preserved)

### Component counts
- 17 skills (+1 ae:agent-teams), 17 agents (+3 doodlestein), 2 MCP servers

## v0.3.0 — 2026-04-02

### ae:test-plugin — Adversarial Behavioral Testing
- **New skill**: `/ae:test-plugin` — adversarial behavioral testing for plugin skills/agents
  - 3 input modes: skill name, `--recent` (git diff), `--all` (full scan)
  - Phase 1: Agent Teams test generation (test-lead + prompts-writer + answer-writer)
  - Phase 2: two-layer execution — Layer 1 deterministic (pass/fail) + Layer 2 behavioral (LLM-as-judge)
  - Phase 3: Markdown test report with pass/fail breakdown
- **New agent**: `test-lead` — adversarial testing lead, generates test cases, reviews writers, enforces communication isolation
- **Sample test cases**: 3 Markdown test cases in `plugins/ae/tests/` (refuse behavior, plan output format, review mode config)
- **Test case format**: Markdown per case with MUST/MUST_NOT/SHOULD behavioral assertions

### Component counts
- 16 skills (+1 ae:test-plugin), 14 agents (+1 test-lead), 2 MCP servers

## v0.2.2 — 2026-04-02

### Agent Autonomy + Step Weight Calibration
- **TL Autonomy operational rules**: 6 concrete rules in CLAUDE.md (P3 auto-skip, single-option converge, high-reversibility fast-track, etc.). 3 workflow agents reference these rules.
- **Review mode**: `work.review_mode: full|light` in pipeline.yml. `--light` flag for Claude-only code review (skip cross-family). `--skip-review` flag for ae:plan to skip Agent Teams Plan Review.
- **Proxy timeout protocol**: unified 120s dual timeout (proxy + challenger) defined in agent-selection, referenced by 4 skills.
- **Actionable Next Steps**: work/review/plan completion suggests exact executable commands, SCM-agnostic.
- **Emoji removal**: Next Steps sections cleaned up per CLAUDE.md style.

### Component counts
- 15 skills, 13 agents, 2 MCP servers (unchanged — skills enhanced, not added)

## v0.2.1 — 2026-04-01

### Bug Fixes — Skill/Agent Implementation Audit
- **qa.md**: replace hardcoded CLI `codex -p review` with MCP proxy calls + add Gemini as second cross-family reviewer
- **ae:review**: fixup loop limit (configurable via `work.max_fix_loops`, default 3) + remove `git rebase -i` flag
- **ae:plan + plan-review**: unify Must Fix behavior (direct apply, no user confirm) + update plan status to `reviewed` after inline review + Expected files marked REQUIRED in step template
- **ae:setup**: guide `test.command` configuration + add `test.framework` to template + remove `cross-family-status.json` dead write
- **ae:code-review**: remove `pipeline.yml agents.code_reviewers` dependency, use runtime agent discovery
- **ae:work**: replace undefined "subagent mode" with explicit "Lead inline execution" protocol

### Component counts
- 15 skills, 13 agents, 2 MCP servers (unchanged — skills/agents fixed, not added)

## v0.2.0 — 2026-04-01

### Implementation Audit
- **Auto-pass gate fix**: `no test command` and `no Expected files` now trigger UNVERIFIED/UNKNOWN pause instead of silent bypass
- **Doodlestein role reversal**: Attacker/Defender pattern replaces independent Q1/Q2/Q3 questionnaire — validated with real attack/defense exchange
- **Agent persistence**: "STAY IN THE TEAM" protocol for multi-round discussions — agents survive across rounds
- **Agent definition trimming**: removed duplicate rules from proxy/challenger definitions (v0.1.2 bloat caused Gemini proxy timeout)
- **CLAUDE.md principles**: agent definition rules (no duplication, one-line, test after changes), TL autonomy boundary, 先运行后决策 principle
- **/ae:consensus first execution**: smoke test successful — 5-agent debate produced majority consensus with cross-examination

### AE Evolution — Pipeline Validation + Infrastructure
- **ae:retrospect skill** (NEW): reads Outcome Statistics from `/ae:review` output, generates trend reports with actionable insights. Includes `--compare ID1 ID2` mode for report-to-report comparison with arrow + absolute delta format.
- **WebSearch/WebFetch expansion**: added to challenger and architect agents. Permission principle: research-type agents (need external/time-sensitive data) get access; execution-type (proxy, review) do not.
- **Next Steps standardization**: all 14 skills now have `## Next Steps` sections with conditional suggestions based on skill output and pipeline state (if/then style).
- **Reversibility observation protocol**: discuss SKILL.md now requires `reversibility_basis` when scoring topics. Conclusion template includes `## Reversibility Observation` section.
- **Pipeline end-to-end validation**: full discuss→plan→work→review cycle executed on ae:retrospect comparison mode. First Outcome Statistics produced.

### Component counts
- 15 skills (+1 ae:retrospect), 13 agents, 2 MCP servers

## v0.1.2 — 2026-03-31

### Cross-family Prompt Infrastructure
- **Proxy prompt assembly checklist**: codex-proxy and gemini-proxy now require Role + Task + Context + Output Format before querying external models
- **Response verification**: proxies self-check external model responses for required sections (Findings / Unique Insights / Agreements)
- **Result handling rules**: 5 rules added to both proxies — preserve structure, preserve evidence boundaries, no rewriting, no auto-fix (with concrete OK/NOT-OK examples), fail honestly
- **Challenger adversarial strengthening**: attack surface checklists tagged by scene (`[CODE REVIEW]` vs `[DESIGN DISCUSSION]`), calibration rules (quality > quantity, cross-family agreement ≠ severity increase), finding bar (4-question requirement)
- **Reviewer tool constraint documentation**: all 5 reviewer agents now have explicit "Write/Edit intentionally excluded" comments

### Future direction (from Doodlestein review)
- AGENT_CONTRACT.md (centralized agent constraints) and MCP middleware (transport-layer validation) identified as evolution paths when architecture matures

### Component counts
- 14 skills, 13 agents, 2 MCP servers (unchanged — agents enhanced, not added)

## v0.1.1 — 2026-03-31

### Adaptive Mediator Consensus
- **Multi-round debate**: `/ae:consensus` upgraded from single-round to adaptive multi-round — mediator evaluates Round 1 with qualitative YES/NO signals, conditionally triggers cross-examination
- **Structured output schema**: advocate/critic must use Claims/Evidence/Conceded/Unaddressed format — mediator parses structured data, not free-form text
- **Cross-examination round**: when triggered, mediator extracts opponent's top claims and distributes; each side must respond per-claim (agree/partially agree/disagree)
- **Mode flags**: `--quick` (3 agents, no cross-family, skip evaluation), `--full` (force cross-examination), default adaptive
- **Mediator Phase 1/Phase 2 separation**: evaluation (ROUND_DECISION) and synthesis (verdict) are clearly separated phases to avoid context competition
- **Max 3 rounds cap**: prevents infinite loops on ambiguous topics

### Component counts
- 14 skills, 13 agents, 2 MCP servers (unchanged — consensus enhanced, not added)

## v0.1.0 — 2026-03-30

### Dynamic Agent Selection
- **Centralized agent selection**: `skills/agent-selection/SKILL.md` — unified selection table referenced by all 12 Agent Teams skills
- **Context-aware team composition**: TL selects agents based on task context signals, not hardcoded lists
- **Cross-family as external experts**: TL decides review angle, proxy assembles full prompt (two-layer assembly)
- **Auto-pass default ON**: gate passes → auto-continue, pause only on exception. Removed `--auto N`.

### Challenger Format
- **Structured disagreement**: Claim/Evidence/Objection/Confidence — no free-form challenges
- **Disagreement Value Assessment**: tracks which challenges changed conclusions

### /ae:work Rewrite
- **Inline drift detection**: contract extraction moved into pre-commit (no separate phase)
- **Execution flow diagram**: top of file for agent orientation
- **Pre-commit checks A-G**: letter labels, contract verification, disposition efficiency

### Knowledge Management
- **docs/references/**: external sources with borrowed/discarded rationale
- **NykDev framework analysis**: "Agreement is a bug" comparison
- **docs/backlog/**: 6 tracked items for future work

### Component counts
- 14 skills (was 13 — added agent-selection contextual skill), 13 agents, 2 MCP servers

## v0.0.9 — 2026-03-30

### Discussion Convergence
- **Three-state scoring**: topics scored as converged/revisit/deferred (no irresolvable escape)
- **Multi-round discussion**: no fixed round limit, revisit until convergence
- **Sweep mechanism**: all deferred items must resolve before conclusion — converge, spawn new discussion, or explain why
- **Topic directory structure**: `summary.md` + `round-NN.md` per topic, agent only reads summary each round (O(1) context vs O(n))
- **Process Metadata**: auto-embedded in conclusion, makes incomplete process visible
- **Downstream validation**: `/ae:plan` checks conclusion completeness

### Harness Phase 3
- **Doodlestein challenge**: cross-family 3-question challenge (Smartest Alternative / Problem Validity / Regret Prediction) at discuss conclusion and plan confirm
- **Outcome statistics**: `/ae:review` reports rework rate, P1 escape rate, drift events, auto-pass rate
- **Auto-pass default ON**: gate passes → auto-continue, pause only on exception. Removed `--auto N` parameter.

### Challenger Improvements
- **Structured disagreement**: challenges must use Claim/Evidence/Objection/Confidence format
- **Disagreement Value Assessment**: tracks which challenges changed conclusions vs dismissed

### Documentation
- **docs/references/**: knowledge sources with what we borrowed, discarded, and why
- **NykDev framework analysis**: compared "Agreement is a bug" 11-agent framework with ae

### Component counts
- 13 skills, 13 agents, 2 MCP servers

## v0.0.8 — 2026-03-29

### Harness Improvement Phase 2
- **Contract extraction**: `/ae:work` extracts `files_allowed` and `target_ac` from plan's "Expected files:" before each step. Graceful degradation when plan lacks this field.
- **Drift verification**: Post-step `git diff --name-only` checked against contract. Violations trigger soft pause with fix/approve/rollback options. Approved drifts recorded in commit message.
- **Auto-pass gate** (opt-in): When `work.auto_pass: true` in pipeline.yml, steps auto-continue if tests green + no P1 + contract verified. Contract violations and security-sensitive files always force pause.
- **Pipeline config**: `work.max_fix_loops`, `work.auto_pass`, `work.security_patterns` added to pipeline template
- **Plan template**: Steps now include "Expected files:" line for contract extraction

## v0.0.7 — 2026-03-29

### Harness Improvement Phase 1
- **Fix loop circuit breaker**: `/ae:work` TDD cycle detects consecutive test failures on same file, stops after 3 (configurable) with retry/defer/help options
- **Git diff transparency**: `/ae:work` shows `git diff --stat` before each commit for drift visibility
- **Disposition efficiency**: Pre-commit auto-skips P3 and P2-style/naming findings, only shows P1 + P2-logic/security
- **Plan quality self-check**: `/ae:plan` verifies step completion conditions, AC verifiability, and expected file lists before review
- **Discussion decision self-check**: `/ae:discuss` requires rationale, reversibility rating, and evidence for each decision

### Documentation
- **Harness improvement**: design discussion with 2 rounds of Agent Team review
- **Plan 002**: 3-phase implementation plan for evaluation criteria, automation gates, drift detection

## v0.0.6 — 2026-03-23

### Features
- **`/ae:plan-review`**: Standalone plan review command — re-review an existing plan with Agent Teams without regenerating it

### Component counts
- 13 skills (was 12), 13 agents, 2 MCP servers

## v0.0.5 — 2026-03-23

### Features
- **Agent Teams pre-check**: All 9 skills that use Agent Teams now check `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled before executing — refuses with actionable instructions if missing
- **Setup detects Agent Teams**: `/ae:setup` checks and reports Agent Teams status during initialization
- **README updated**: Prerequisites section documents Agent Teams requirement with setup instructions

## v0.0.4 — 2026-03-22

### Fixes
- **Gemini MCP startup**: Move dep install from SessionStart hook into `.mcp.json` command — fixes race condition where MCP connection started before `npm install` finished
- **GEMINI_API_KEY passthrough**: Add `env` block to `.mcp.json` so the key is forwarded to the Gemini server process

## v0.0.3 — 2026-03-22

### Improvements
- **Agent auto-discovery**: Skills discover agents at runtime from all sources (project, plugins, global) — no need to list agents in pipeline.yml
- **Gemini model auto-discovery**: New `models` tool lists available models via API, agents pick models at runtime. Removed `gemini_model` from pipeline.yml.
- **Auto-setup on first use**: Skills auto-trigger `/ae:setup` when pipeline.yml is missing instead of refusing to execute
- **Review findings fixed**: testgen field name bug, review empty test.command, code-review scratch status, think scratch recovery
- **Proxy failure deadlock fix**: Proxies now notify the team lead (not Lead) on failure, preventing hang
- **Scratch project isolation**: frontmatter `project` field + recovery filters by repo name
- **dist/ included in repo**: Gemini MCP server works immediately on plugin install without build step

## v0.0.2 — 2026-03-22

### Unified Output Specification

- **pipeline.yml output block**: 6 semantic slots (discussions, plans, milestones, backlog, reviews, analyses) with sensible defaults. Replaces old `output.review` + `output.plans`.
- **Scratch persistence**: All skill outputs auto-save to `~/.claude/scratch/<project-hash>/` for session resilience. Survives compact/crash/close.
- **Persistence prompts**: High-value skills (trace, consensus, think) ask user to formally save after completion. Low-ceremony skills (code-review, team) save silently, archived in bulk during `/ae:review`.
- **Session recovery**: All skills with pre-checks now scan scratch for `status: in_progress` items and prompt user to resume.
- **Action log format**: code-review findings tracked with action (fix now / backlog / skip) and status (pending / in_progress / resolved).
- **Unified naming**: `NNN-slug` convention with YAML frontmatter (`id`, `title`, `type`, `created`, `status`) across all file-writing skills.
- **cross-family-review**: Moved from `skills/` to `docs/` — it's a reference document, not a slash command.

### Component counts
- 12 skills (was 13 — cross-family-review moved to docs)
- 13 agents
- 2 MCP servers
