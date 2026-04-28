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
   - Phrasing: `Proposed size: M (~2-3 days) — based on <one-line reason>. Accept / adjust to <X> / skip?`
   - **Reconciliation rule**: if `index.md` already has a `size:` value (e.g., user edited it during the analyze run, or this is a re-run), the existing value WINS. `ae:analyze` does NOT overwrite. To re-propose, the user must run `/ae:roadmap --resize` per Step 4 spec — that's the explicit re-proposal flow.
   - User accepts → write `size: <T-shirt>` to frontmatter. Skip / silence → leave field absent.

8. **`depends_on:` — advisory propose.** Same pattern as size: if the BL or research surfaces phrases like "blocked by", "after Y is done", "needs Z first", and one of those targets is itself an active feature (`F-MMM`), propose `depends_on: [F-MMM]`. User accepts → write to frontmatter. Existing `depends_on:` value wins (no overwrite). Multi-target proposals are presented as a list; user accepts/adjusts/skips per item.

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

```
TeamCreate(team_name: "F-NNN-analyze")

Agent(subagent_type: "archaeologist", name: "archaeologist",
      team_name: "<team>", run_in_background: true,
      prompt: "Investigate existing code for: <feature title>.
               Follow Team Communication Protocol.
               Teammates: standards-expert, challenger.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "standards-expert", name: "standards-expert",
      team_name: "<team>", run_in_background: true,
      prompt: "Research industry best practices for: <feature title>.
               Follow Team Communication Protocol.
               Teammates: archaeologist, challenger.
               Wait for archaeologist's code analysis before comparing.
               SendMessage findings to team-lead when done.")

Agent(subagent_type: "challenger", name: "challenger",
      team_name: "<team>", run_in_background: true,
      prompt: "Challenge findings from archaeologist + standards-expert for: <feature title>.
               Follow Team Communication Protocol.
               Step 1: independent blind-spot review.
               Step 2: wait for teammate findings, then challenge.
               You are pure opposition. Do NOT synthesize — TL synthesizes.
               SendMessage challenges to team-lead when done.")

# For each enabled proxy in pipeline.yml cross_family:
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "Research <feature title> via <proxy> MCP — <assigned angle>.
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

```markdown
---
id: "F-NNN"
title: "Analysis: <feature title>"
type: analysis
created: YYYY-MM-DD
tags: [relevant, tags]
---

# Analysis: <feature title>

## Question
<original BL body / user description, verbatim>

## Findings

### Prior Art from Project Knowledge Base
<from Mengdie if available; "Prior context: unavailable" otherwise>

### Relevant Code
<key files + line refs from archaeologist>

### Architecture & Patterns
<how the codebase handles similar scenarios>

### Industry Practice Comparison
<from standards-expert>

### Challenges & Disagreements
<from challenger + cross-family>

## Summary
<concise answer; key takeaways>

## Possible Next Steps
<suggest /ae:discuss inside this feature dir if decisions remain, or /ae:plan if path is clear>
```

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
5. **Next step**: `/ae:discuss .ae/features/active/F-NNN-<slug>/` if decisions remain, or `/ae:plan` if the path is clear.

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
- Path is clear → `/ae:plan` (will create a plan inside the feature dir per Step 5 of Plan 051's path migration; until then, plan files still land in `.ae/plans/` and link via plan frontmatter `feature:` field).
- Deeper investigation needed → `/ae:trace` (execution flow) or `/ae:think` (focused deep-dive).
