---
name: ae:analyze
description: GTD Organize — promote a BL to a feature dir (or analyze a free-text feature directly into one). Codebase research + structured analysis.
argument-hint: "<BL-NNN> | <feature description>"
user-invocable: true
effort: medium
---

# /ae:analyze — GTD Organize

Research the codebase + organize the result into a feature directory at `.ae/features/active/F-NNN-slug/`. This is the GTD **Organize** phase: a captured BL (or a free-text feature description) becomes an actionable Project — file, frontmatter, analysis, advisory size + depends_on — ready for `/ae:discuss` or `/ae:plan`.

Skill input: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:analyze creates 4 tasks per invocation. Mode A and Mode B are mutually exclusive — only one is created at runtime based on Mode selection.

| Phase | Subject | Created at | `in_progress` | `completed` |
|---|---|---|---|---|
| Pre-check | `ae:analyze: Pre-check` | Skill start | Before pre-check 1 | After pre-checks pass |
| Mode A or Mode B | `ae:analyze: Mode A — Promote BL` OR `ae:analyze: Mode B — Free-text Feature` | After Mode selection (deferred until input is parsed) | At Mode entry | Mode A: BL moved + index.md written; Mode B: feature dir + index.md created |
| Research | `ae:analyze: Research` | Skill start (batch) | When agent-teams Research team spawned | When all reviewer findings received at TL |
| Synthesize | `ae:analyze: Synthesize` | Skill start (batch) | When TL begins synthesis | When analysis.md persisted to disk |

At skill start, batch-create:

```
TaskCreate(subject: "ae:analyze: Pre-check")
TaskCreate(subject: "ae:analyze: Research")
TaskCreate(subject: "ae:analyze: Synthesize")
```

After Mode selection (Mode A vs Mode B determined from $ARGUMENTS), create the mode-specific task:

```
TaskCreate(subject: "ae:analyze: Mode A — Promote BL")    # if BL-NNN input
# OR
TaskCreate(subject: "ae:analyze: Mode B — Free-text Feature")    # if free-text input
```

Owner field: omit. On error: stay `in_progress`.

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. Missing → `Run /ae:setup first.` Stop.
2. Confirm `.ae/features/active/`, `.ae/features/done/`, `.ae/features/abandoned/` exist. Missing → `Project hasn't bootstrapped GTD; run Plan 050 setup first.` Stop. (Defensive — should be rare once Plan 050 ships.)
3. **Agent Teams**: read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **auto-fallback**: print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` and proceed with TL executing the analysis directly. Output is lower confidence but structurally identical.

## Mode selection

Inspect `$ARGUMENTS`:

- **Mode A (Promote)** — input matches the regex `^BL-[0-9]+$` (case-insensitive `BL-` prefix + digits, possibly with leading whitespace), OR the user explicitly asks "promote BL-NNN" / "make BL-NNN a feature" / similar intent. Run the promote flow.
- **Mode B (Free-text feature)** — input is free-text describing a feature to research directly (no BL exists for it yet). Run the analyze flow with `origin_bl:` left empty in the resulting feature index.md.
- **Pure research without feature intent** — if the user is asking "how does X work?" / "what's the state of Y?" without intending to ship anything, suggest `/ae:trace` or `/ae:think` instead and stop. This skill always produces a feature dir; using it for read-only research creates noise.

## Mode A: Promote BL → Feature

### Pre-approved values input (BL-063 / F-007)

`/ae:analyze` may be invoked from `/ae:roadmap`'s batch-approval orchestration loop (per F-007). When invoked from that loop, the spawn prompt contains a `PRE_APPROVED_VALUES` block that pre-fills the Step 7 (size) and Step 8 (depends_on) interactive advisories so the user is not re-prompted per BL.

**Format spec authority**: the canonical `PRE_APPROVED_VALUES` block format is defined in `plugins/ae/skills/roadmap/SKILL.md` section (a) "Batch-approval block" subsection (Step 1's "Canonical PRE_APPROVED_VALUES block format" sub-bullet). This skill RECOGNIZES and CONSUMES that format; it does NOT redefine it. Any change to the wire format MUST update `roadmap/SKILL.md` first; this skill references it.

**Recognition**: at the start of Mode A — before the double-promote pre-check, before any agent spawn — grep the spawn prompt for the literal opening sentinel `---PRE_APPROVED_VALUES---`. The sentinel must appear as a free-standing line (not inside a fenced code block, not quoted in surrounding prose); SKILL.md text that documents the format is NOT a live block. If found, parse the block's `size:` and `depends_on:` field values and stash them for Steps 7 + 8 to consume. If absent, proceed with normal interactive flow (today's behavior — unchanged).

**Malformed-block fallback** (per F-007 ship review — gemma + challenger + codex convergent finding on sentinel-parsing brittleness):

- **Missing closing sentinel**: opening `---PRE_APPROVED_VALUES---` found but `---END_PRE_APPROVED_VALUES---` absent → log `[ANALYZE] PRE_APPROVED_VALUES block malformed (missing closing sentinel); falling through to interactive prompts for size + depends_on.` Discard any partially-parsed values; Step 7 + Step 8 run interactively as if the block were absent.
- **Invalid `size:` value**: parsed value is not in `{XS, S, M, L, XL}` → log `[ANALYZE] PRE_APPROVED_VALUES.size invalid: <value>; falling through to interactive size prompt.` Skip the pre-approved-size guard for this invocation; Step 7 runs interactively. (Other fields, if valid, still apply — partial fallback.)
- **Invalid `depends_on:` value**: parsed value is not the literal `none` AND does not match the comma-separated F-NNN format (e.g., contains non-`F-NNN` tokens, malformed list syntax) → log `[ANALYZE] PRE_APPROVED_VALUES.depends_on invalid: <value>; falling through to interactive depends_on prompt.` Skip the pre-approved-depends_on guard; Step 8 runs interactively.
- **Empty `depends_on:` value** (line present, no text after the colon): treat as the literal `none` — skip frontmatter write, no Step 8 prompt. Producer (`/ae:roadmap`) is specified to elide the line entirely when there are no deps, so this case shouldn't arise in practice; the parser tolerates it for forward-compatibility with future producer changes.

These fallbacks are intentionally LOUD (warning logs) so a malformed-block silent-failure becomes visible to the user. The fallback semantics is "behave as if the block were absent for the affected field" — never block execution, never invent values.

**Standalone-invocation invariant**: when `/ae:analyze BL-NNN` is invoked directly by the user (not via `/ae:roadmap` orchestration), the `PRE_APPROVED_VALUES` block is absent from the spawn prompt and Steps 7 + 8 retain their full interactive `AskUserQuestion` flow. The pre-approved path is opt-in via the explicit block's presence; no behavior change for direct invocations.

**Partial fields**: the block may contain only `size:`, only `depends_on:`, or both. A missing field falls through to the normal interactive prompt for that field (e.g., block has `size: M` but no `depends_on:` line → Step 7 skips its prompt, Step 8 runs normally). Value `none` for `depends_on` means "explicitly no dependencies" and skips Step 8's write without inserting the field into frontmatter.

**Reconciliation invariant unchanged**: if the new feature's `index.md` already has `size:` / `depends_on:` set (e.g., user edited mid-run, or this is a re-run), the existing value WINS regardless of pre-approved input. Pre-approved values only apply when the corresponding frontmatter slot is empty.

### Pre-check — defend against double-promote

1. **Locate the BL file.** Search recursively under `<output.backlog>` (default `.ae/backlog/`) for `BL-<NNN>-*.md`. Files may live in `unscheduled/`, `closed/`, `done/`, or any sprint subdir. Not found → **refuse**: `BL-<NNN> not found in any backlog scope.`

2. **Already-promoted check.** Grep `origin_bl:` across `.ae/features/{active,done,abandoned}/*/index.md`. Match BOTH scalar and list forms — `origin_bl: BL-042` AND `origin_bl: [BL-042, BL-051]` both count as promoted.
   - **Already in `active/` or `done/`** → **hard refuse**:
     ```
     BL-<NNN> is already promoted to F-XXX (status: <active|done>).
     Open .ae/features/<state>/F-XXX-slug/ to see progress.
     ```
   - **Already in `abandoned/`** → **soft refuse**:
     ```
     BL-<NNN> was promoted to F-XXX previously, then abandoned.
     To restart it, manually mv .ae/features/abandoned/F-XXX/ → .ae/features/active/F-XXX/
     and edit index.md status back to active. (Going through /ae:analyze again
     would create a second feature — refused to keep the audit trail clean.)
     ```

### Promote steps

Execute in order; each step's success is required for the next.

1. **Allocate next F-NNN.** Scan `.ae/features/{active,done,abandoned}/F-*/index.md` recursively, parse the `F-NNN` digits from each dir name, take `max(NNN) + 1`. Zero-pad to 3 digits. Empty state → start at `F-001`. Feature IDs are independent of BL IDs (do not reuse the BL's number).

2. **Slugify the BL title** deterministically. Apply the **same step-by-step rule as `/ae:backlog`** (lowercase → strip non-ASCII → non-alphanum runs → `-` → trim leading/trailing `-` → truncate to 40 chars by right-side cut → re-trim trailing `-` → empty fallback to bare `F-NNN`). See `plugins/ae/skills/backlog/SKILL.md` step 3 for the canonical sequence; the order is load-bearing — do not reorder steps.

3. **Create the feature dir**: `mkdir -p .ae/features/active/F-NNN-<slug>/`.

4. **Move the BL file**, preserving the `BL-NNN.md` filename (drops the slug suffix from the BL filename — the BL's own slug isn't useful inside the feature dir, and bare `BL-NNN.md` makes grep / cite cleaner):
   ```
   mv <found-bl-path>/BL-<NNN>-*.md .ae/features/active/F-NNN-<slug>/BL-<NNN>.md
   ```

5. **Update the moved BL file's frontmatter** (in place):
   ```yaml
   status: promoted          # was: open / unscheduled
   promoted: YYYY-MM-DD      # today
   promoted_to: F-NNN        # back-pointer to the feature
   ```
   Preserve all other frontmatter fields. The BL stays under the feature dir as the original audit-trail document.

6. **Create the feature `index.md`.** The frontmatter schema is the **single source of truth in CLAUDE.md → `## Project Management (GTD)` → Feature index.md frontmatter schema**. Do NOT redefine the schema here. The minimum required fields:
   ```yaml
   ---
   id: F-NNN
   title: <BL title verbatim>
   status: active
   created: YYYY-MM-DD
   origin_bl: BL-<NNN>            # scalar OR list — see (6a)
   ---
   ```
   Optional fields (`theme`, `roadmap`, `size`, `depends_on`) are written by steps 7 and 8 below if and only if the user accepts the proposals.

   **(6a) `origin_bl:` shape.** Single-BL promote (the typical case) writes a scalar string. Multi-BL consolidation (the user explicitly says "promote BL-042 and BL-051 together as one feature") writes a list. N decomposition (one BL becomes multiple features) is handled by running `/ae:analyze` separately per resulting feature; each output index.md has the same `BL-NNN` in its `origin_bl:` — readers tolerate this overlap per CLAUDE.md Reader contract (a BL appearing in multiple features' `origin_bl` is treated as promoted to all of them; double-promote pre-check trips for any subsequent run).

7. **T-shirt size — advisory propose.** After the codebase research (step 9 below) completes — but BEFORE writing `size:` — present the user with a proposed size based on archaeology + LLM judgment of complexity:
   - Valid values: `XS / S / M / L / XL` (mapped to approximate effort in CLAUDE.md, NOT to "Shape Up appetite" — that label was a misnomer in earlier drafts).
   - **Pre-approved-values guard** (BL-063 / F-007): if the spawn prompt contained a `PRE_APPROVED_VALUES` block with a `size:` value (parsed at Pre-approved values input step at top of Mode A), skip the `AskUserQuestion` and write `size: <pre-approved T-shirt>` directly to frontmatter. Log: `[ANALYZE] Using pre-approved size: <T-shirt> (from /ae:roadmap batch).` This guard fires before the propose-and-confirm flow below.
   - Phrasing (when no pre-approved value): `Proposed size: M (~2-3 days) — based on <one-line reason>. Accept / adjust to <X> / skip?`
   - **Reconciliation rule**: if `index.md` already has a `size:` value (e.g., user edited it during the analyze run, or this is a re-run), the existing value WINS regardless of pre-approved input. `ae:analyze` does NOT overwrite. To re-propose, the user must run `/ae:roadmap --resize` per Step 4 spec — that's the explicit re-proposal flow.
   - User accepts → write `size: <T-shirt>` to frontmatter. Skip / silence → leave field absent.

8. **`depends_on:` — advisory propose.** Same pattern as size: if the BL or research surfaces phrases like "blocked by", "after Y is done", "needs Z first", and one of those targets is itself an active feature (`F-MMM`), propose `depends_on: [F-MMM]`.
   - **Pre-approved-values guard** (BL-063 / F-007): if the spawn prompt contained a `PRE_APPROVED_VALUES` block with a `depends_on:` value, skip the `AskUserQuestion` and apply it directly. If the value is the literal `none`, do NOT write `depends_on:` to frontmatter (skip the write entirely — same as today's "no proposal" outcome). Otherwise parse the value as a list (`F-NNN` or `F-NNN, F-MMM`) and write `depends_on: [F-NNN, ...]` to frontmatter. Log: `[ANALYZE] Using pre-approved depends_on: <value> (from /ae:roadmap batch).` This guard fires before the propose-and-confirm flow.
   - User accepts → write to frontmatter. Existing `depends_on:` value wins (no overwrite). Multi-target proposals are presented as a list; user accepts/adjusts/skips per item.

9. **Run the codebase research flow** (see "Agent Teams Research" below) and write the synthesized output to `.ae/features/active/F-NNN-<slug>/analysis.md`.

## Mode B: Free-text feature

The user is proposing a feature directly without going through the BL inbox. Same skeleton as Mode A, simpler:

1. Slugify the user's description (same rule as Mode A step 2).
2. Allocate next F-NNN (same rule as Mode A step 1).
3. `mkdir -p .ae/features/active/F-NNN-<slug>/`.
4. Create `index.md` with frontmatter:
   ```yaml
   id: F-NNN
   title: <description verbatim, or LLM-shortened to a one-line title if input is long>
   status: active
   created: YYYY-MM-DD
   origin_bl: ""           # empty — origin is direct user request, not a captured BL
   ```
5. Same advisory flow for `size:` (step 7 of Mode A) and `depends_on:` (step 8).
6. Run the codebase research flow → `analysis.md`.

No BL file exists for Mode B; nothing to move, no `promoted:` writeback.

## Agent Teams Research

Once the feature dir exists and the BL is moved (Mode A) or the index.md is written (Mode B), kick off the codebase research that produces `analysis.md`.

**Select agents**: refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: read `cross_family` from pipeline.yml. For each enabled family (codex/gemini), include its proxy agent. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback.

**Before `TeamCreate`** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

```
TeamCreate(team_name: "F-NNN-analyze")

Agent(subagent_type: "archaeologist", name: "archaeologist",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: archaeologist
                  Role: research lead (code archaeology)
                  Angle: existing code structure + dependency chains
                  Why: TL needs factual baseline before standards-expert compares to industry

               Investigate existing code for: <feature title>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: standards-expert
                  Role: research support (industry comparison)
                  Angle: framework + version specific best practices
                  Why: bridges archaeology evidence to industry patterns; informs architect decisions

               Research industry best practices for: <feature title>.
               Follow Team Communication Protocol.
               Teammates: archaeologist, challenger.
               Wait for archaeologist's code analysis before comparing.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: challenger
                  Role: opposition (analyze mode)
                  Angle: blind spots in archaeologist + standards-expert findings
                  Why: pure adversarial pass before TL synthesizes (F-019 challenger.md migration: mode behavior embedded here, not in agent body)

               Analyze mode protocol steps (embedded per F-019 mode migration):
               1. Parallel Launch: Wait for Archaeologist + Standards Expert (TL forwards); call Codex/Gemini independently for research on the topic.
               2. Challenge + Cross-family: After teammate findings arrive, combine with cross-family opinions. SendMessage to the teammate who produced the finding with your challenge.
               3. Discussion: Wait for teammate responses; follow up with cross-family if new arguments emerge; form consensus or mark disagreements.
               4. Aggregate and Report: SendMessage to team-lead with all discussions, marking consensus and disagreements.

               Challenge findings from archaeologist + standards-expert for: <feature title>.
               Follow Team Communication Protocol.
               Step 1: independent blind-spot review.
               Step 2: wait for teammate findings, then challenge.
               You are pure opposition. Do NOT synthesize — TL synthesizes.
               SendMessage challenges to team-lead when done.")

# For each enabled proxy in pipeline.yml cross_family:
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family research (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; independent family perspective complements core team

               Research <feature title> via <proxy> MCP — <assigned angle>.
               Teammates: archaeologist, standards-expert, challenger.
               SendMessage findings to team-lead when done.")
```

**TL orchestration — dependency graph**:
- archaeologist → standards-expert: TL forwards code findings to standards-expert (waiting for code analysis before comparing).
- archaeologist + standards-expert → challenger: TL forwards compiled findings to challenger (waits for teammates before challenging).

Also read project context files (CLAUDE.md, docs/) for background.

### Prior context (Mengdie integration)

After all teammates have SendMessage'd findings to TL, before synthesis:

1. Call `memory_search` MCP with the feature title as query.
2. Tool unavailable / no results / errors → emit `Prior context: unavailable (tool not registered / no relevant results)` and continue.
3. Results with `degraded` field non-null → annotate as "(partial — [degraded reason])".
4. Render under `## Prior Art from Project Knowledge Base` with provenance per item: `title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`.
5. Treat as background context only — does not constrain current evidence.

### Synthesize + write `analysis.md`

TL collects findings, resolves disagreements, writes to `.ae/features/active/F-NNN-<slug>/analysis.md`:

**Per CLAUDE.md `Output Standards`** — pyramid tip ≤ 5 lines (required), supporting detail below (on-demand, omit empty sections). TL must first understand and distill — do not just splice raw agent findings together.

```markdown
---
id: "F-NNN"
title: "Analysis: <feature title>"
type: analysis
created: YYYY-MM-DD
---

# Analysis: <feature title>

## TL;DR

- **Question**: <one sentence — restate the BL's core problem, not the full text>
- **Current judgment**: <one sentence — TL's stance after synthesizing agent research, not raw aggregation>
- **Key open questions**: <0-2 items — items the user must decide / still-disputed; write "none" if there are none>
- **Next step**: <concrete: /ae:discuss / /ae:plan / close / wait for trigger / etc.>

---

## Supporting detail

Only write the sections below when the TL;DR tip is insufficient to carry the user's judgment. Each section appears on demand independently; **omit empty sections** — do not write "skipped X because overkill".

### Key evidence (on-demand)
<archaeologist + agent research findings, cite file:line. Remove redundant / low-signal findings; do not give every agent its own flat section.>

### Counter-opinions handled (on-demand)
<key challenges raised by challenger / cross-family + disposition (accepted / rejected + one-sentence reason / deferred to BL). Do not enumerate everything verbatim.>

### Industry comparison (on-demand)
<standards-expert, only when it has actionable impact on the current judgment. Otherwise omit.>

### Mengdie prior art (on-demand)
<only when there are relevant results. No results → do not write an "unavailable" placeholder.>
```

**Anti-patterns** (violate Output Standards):
- 9 flat sub-sections (`Question` / `Findings` / `Prior Art` / `Relevant Code` / `Architecture` / `Industry Practice` / `Challenges` / `Summary` / `Next Steps`) — once a section exists it must be filled; if there is nothing substantive, authors write "not done"
- No TL;DR; user must read the whole document before they can make a judgment
- Each agent gets its own flat section, 60%+ content overlap across sections

### Knowledge capture (Mengdie)

After `analysis.md` is written, before closing the team. Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) (max 3 items, atomic, graceful degradation, conflict handling).

**Skill-specific extraction**:
- One item per key finding from the analysis's `## Findings` section.
- Skip findings that restate prior art surfaced in the prior-context step.
- `source_type`: `conclusion`
- `knowledge_type`: `factual`
- `entities`: derive from each specific finding (e.g., `fts5-idf-contamination`), NOT from broad frontmatter tags.
- `source_file`: path to the new `analysis.md`.

## Close team + present

Send `shutdown_request` to all teammates. Show the user:

1. `Created feature F-NNN: <title>` + path to the feature dir.
2. Mode A only: `Moved BL-<NNN> → F-NNN-<slug>/BL-<NNN>.md (frontmatter: status=promoted, promoted_to=F-NNN).`
3. Confirmed `size:` and `depends_on:` values, if any.
4. Knowledge-capture summary: `[N] items ingested, no conflicts` or `conflicts detected with: [titles]`.
5. **Next step**: `/ae:discuss .ae/features/active/F-NNN-<slug>/` if decisions remain, or `/ae:plan` if the path is clear. Plan 051+ note: subsequent `/ae:discuss`, `/ae:plan`, `/ae:review` outputs will write inside this feature dir (`<feature-dir>/discussions/<NNN>-<slug>/`, `<feature-dir>/plan.md`, `<feature-dir>/review.md`) — feature ID is path-derived from `F-NNN`. The feature dir is now the canonical home for all per-feature artifacts.

## Edge cases — abandon and re-promote

The skill does NOT handle these flows; they are documented here so the user (and future skill iterations) know the convention:

### Abandon a feature

User decides a feature is no longer worth pursuing (superseded, scope-out, redundant):

1. `mv .ae/features/active/F-NNN-<slug>/ .ae/features/abandoned/F-NNN-<slug>/`. The whole dir moves; the original `BL-NNN.md` rides along.
2. Edit the feature `index.md` frontmatter:
   ```yaml
   status: abandoned
   abandoned: YYYY-MM-DD
   abandoned_reason: <user explanation>
   ```
3. The original BL file's frontmatter is **preserved** — `promoted_to: F-NNN` stays. This keeps the audit trail intact: a future grep for "what happened to BL-XXX?" still resolves to the abandoned feature.

The skill does not auto-restore the BL to inbox. If the user wants to re-capture the idea, they run `/ae:backlog` again with a fresh BL number.

### Re-promote (rare)

User decides an abandoned feature should restart:

1. `mv .ae/features/abandoned/F-NNN-<slug>/ .ae/features/active/F-NNN-<slug>/`.
2. Edit `index.md` frontmatter: `status: active`, remove `abandoned:` and `abandoned_reason:`.

This is a manual mv on purpose. Re-running `/ae:analyze BL-NNN` is **refused** by the soft-refuse pre-check (Mode A above) — that path would create a second feature and split the audit trail. Manual mv preserves identity.

### Recovery — undoing a promote

A promote in Mode A is **not high-reversibility from the user's perspective**: the BL file physically moves out of `.ae/backlog/.../BL-NNN-*.md` into `.ae/features/active/F-NNN-<slug>/BL-NNN.md`, and any external tooling, scripts, or grep habits that pointed at the old path break.

To undo a promote (e.g., the user ran `/ae:analyze BL-042` but later decides BL-042 wasn't ready):

1. Locate the new feature dir: `ls .ae/features/active/` and find the `F-NNN-<slug>` corresponding to the BL.
2. Move the BL file back to its original scope (typically `unscheduled/`):
   ```
   mv .ae/features/active/F-NNN-<slug>/BL-<NNN>.md .ae/backlog/unscheduled/BL-<NNN>-<original-slug>.md
   ```
   The original BL slug isn't preserved in the moved filename (Mode A drops it intentionally), so the user picks a slug consistent with the original capture or runs `/ae:backlog` syntax. Either is acceptable — readers grep on `BL-<NNN>` and frontmatter `id:`, not the slug.
3. Edit the moved BL frontmatter: revert `status: promoted` → `status: open`, remove `promoted:` and `promoted_to:` fields.
4. Remove the now-empty feature dir: `rm -rf .ae/features/active/F-NNN-<slug>/`.
5. (Optional) The F-NNN counter does not roll back automatically — F-NNN is consumed. The next promote allocates F-(NNN+1). This is acceptable; feature IDs need not be contiguous.

Recovery is documented as a manual flow because automating it would require persistent move-history and increase complexity for a rare case (estimated <1% of promotes per typical workflow).

## Principles

- **Single source of truth for the feature schema**: CLAUDE.md → `## Project Management (GTD)` → Feature index.md frontmatter schema. Do NOT duplicate the schema here.
- **Advisory mode for `size:` and `depends_on:`**: propose, ask, write only on accept. Existing values always win — no silent overwrite. Re-propose only via `/ae:roadmap --resize` (size) or manual edit (depends_on).
- **Hard refuse on double-promote** (active/done) protects against accidental duplicate features. **Soft refuse on previously-abandoned** keeps re-promote a deliberate manual action.
- File path references should include line numbers where possible. Focus on facts and code evidence, not speculation.

## Next Steps

Based on the analysis output, suggest:

- Decision points remain → `/ae:discuss .ae/features/active/F-NNN-<slug>/`
- Path is clear → `/ae:plan` will create `<feature-dir>/plan.md` inside this feature dir (Plan 051+ behavior: feature ID is path-derived from the parent dir; optional `feature:` frontmatter is validation-only).
- Deeper investigation needed → `/ae:trace` (execution flow) or `/ae:think` (focused deep-dive).

## Trace emission (final step)

Before skill exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit 9-field trace record to `~/.ae/traces/<session-id>.ndjson` (no LLM content, per-skill-invocation metadata for v0.11.x consumers).
