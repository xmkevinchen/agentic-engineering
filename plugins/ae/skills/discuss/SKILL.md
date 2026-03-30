---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted)
argument-hint: "<topic description or discussion directory path>"
---

# /ae:discuss — Design Discussion

Start a structured design discussion for: **$ARGUMENTS**

## Discussion Flow

```
Create/Load topics → Discuss (multi-round) → Sweep deferred → Doodlestein → Conclusion
                          ↑                        │
                          └── revisit topics ───────┘
```

## Mode Detection

- **Continue mode**: if `$ARGUMENTS` points to an existing discussion directory, load index.md and continue.
- **Create mode**: otherwise, treat $ARGUMENTS as a topic description — research and create a new discussion.

Read `pipeline.yml` → `output.discussions` (default: `docs/discussions/`) for the base directory.

## Create Mode

### 1. Find or Create Discussion Directory

Check `<output.discussions>` for an existing related directory.
- **Exists**: add topics to that directory.
- **New**: next sequential number (zero-padded 3 digits). Create `<output.discussions>/NNN-slug/`.

### 2. Research Codebase

Use Explore agent to investigate related modules, patterns, and constraints. If `analysis.md` exists in the same directory, use its findings.

### 3. Identify Discussion Topics

Find 3-6 key decision points. Each should be a genuine choice with trade-offs.

### 4. Create Topic Directories

Each topic is a **directory** (not a single file) to support multi-round discussion without context bloat:

```
topic-NN-slug/
  summary.md       # Current state — agent reads ONLY this each round
  round-01.md      # First round discussion (archived after round ends)
```

**summary.md** (agent reads this every round — keep concise):

```markdown
---
id: "NN"
title: "[topic title]"
status: pending          # pending → converged / revisit / deferred
current_round: 1
created: YYYY-MM-DD
decision: ""
rationale: ""
reversibility: ""
---

# Topic: [title]

## Current Status
[One-line status: what's been decided or what's blocking]

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| (populated as rounds complete) |

## Context
[Why this decision is needed, what it affects]

## Options
### A: [option name]
- **Pros**: X, Y
- **Cons**: Z

### B: [option name]
- **Pros**: X, Y
- **Cons**: Z

## Recommendation
[Which option and why]
```

**round-NN.md** (full discussion record for each round — archived, not re-read):

```markdown
---
round: NN
date: YYYY-MM-DD
score: pending/converged/revisit/deferred
---

# Round NN

## Discussion
[Full discussion content, user responses, analysis]

## Outcome
- Score: [converged/revisit/deferred]
- Decision: [if converged]
- Revisit reason: [if revisit]
- Deferred reason: [if deferred]
```
```

### 5. Create or Update index.md

```markdown
---
id: "NNN"
title: "[title]"
status: active
created: YYYY-MM-DD
pipeline:
  analyze: skipped
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [relevant, tags]
---

# [Title]

## Problem Statement
[What needs to be solved, why]

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | [Topic A] | [topic-01-slug/](topic-01-slug/) | pending | — |

## Documents
- [Analysis](analysis.md) *(if exists)*
- [Conclusion](conclusion.md) *(after discussion complete)*
```

### 6. Enter Discussion (Continue Mode)

## Continue Mode

### 1. Load Index

Read `$ARGUMENTS/index.md`, parse topic table.
- Show convergence status:
  ```
  📊 Discussion NNN: N topics
  - converged: X ✅
  - revisit: Y 🔄
  - deferred: Z ⏳
  - pending: W
  ```
- If all converged + no deferred → go to Doodlestein
- If has revisit → discuss those next
- If has pending → discuss those next

### 2. Discuss Topics (Multi-round)

For each pending or revisit topic:

1. **Read `topic-NN-slug/summary.md` ONLY** — do NOT read previous round files (they are archived)
2. Present: context + options + recommendation (from summary)
3. Use `AskUserQuestion` to collect user's choice — options include:
   - The listed options (A, B, C...)
   - "需要更多分析" (triggers deeper research)
   - "这个问题需要拆分" (marks as deferred → will spawn new discussion in Sweep)
   - "稍后再议" (marks as deferred)
4. **Score the topic** based on user's response:

| Score | When | Frontmatter | Next |
|-------|------|-------------|------|
| `converged` | User chose an option with clear rationale | `status: converged`, `decision`, `rationale`, `reversibility` | Done, next topic |
| `revisit` | Discussion inconclusive, need more info or different angle | `status: revisit`, `revisit_reason: "..."` | Come back later this round or next round |
| `deferred` | Can be postponed, but MUST resolve before discussion ends | `status: deferred`, `deferred_reason: "..."` | Handle in Sweep |

5. **Quality check** before recording converged decisions:
   - Rationale must reference specific analysis, files, or data (not "综合考虑选 A")
   - High-impact decisions (reversibility: low) need stronger evidence
   - If rationale is weak → prompt user to strengthen or mark as revisit
6. **Write round file**: create `topic-NN-slug/round-NN.md` with full discussion content + outcome
7. **Update summary.md**: update status, add Round History row, update Current Status. Keep summary concise — only key outcomes, not full discussion text
8. Update index.md topic table
9. After each topic, show updated convergence status

**Multi-round**: After all topics discussed once, if any are `revisit`:
- Read `summary.md` (which now includes previous round outcomes)
- Present revisit topics with the `revisit_reason` from summary
- User can provide new info, change approach, or mark as deferred
- New round → new `round-NN.md`, update `summary.md`
- No fixed round limit — continue until no more revisit topics

### 3. Sweep: Resolve All Deferred

After all topics are either converged or deferred (no more revisit):

**Every deferred topic MUST be resolved.** No deferred item survives the Sweep.

For each deferred topic:
1. Present the topic + deferred_reason to user
2. User must choose one of:
   - **Converge now** — make a decision with rationale → `converged`
   - **Spawn new discussion** — problem needs independent discussion → create sub-discussion directory, link from current index.md
   - **Spawn as feature/backlog** — it's an execution problem, not design → write to `output.backlog`
   - **Explain why unresolvable** — document what information is missing + what would trigger revisiting + a recommended assumption to proceed with

Each resolution must be recorded:
```
## Deferred Resolution: [topic title]
- Resolution: [converged / new_discussion / backlog / explained]
- Detail: [decision / link to sub-discussion / backlog item / explanation + assumption]
```

**After Sweep: zero deferred items remain.** Every discussion output is either plannable or spawned into a new trackable unit.

### 4. Doodlestein Challenge

After Sweep, all topics converged (or resolved). Before generating conclusion:

1. Compile summary: topic titles + decisions + one-line rationale each
2. Check cross-family availability (`cross_family` in pipeline.yml):
   - **Select agents**: Read `docs/agent-selection.md` for the selection table and rules.
   - **Cross-family available** → Agent Team:
     ```
     TeamCreate(team_name: "<discussion>-doodlestein")

     Agent(subagent_type: "codex-proxy", name: "codex-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "Answer 3 questions about these decisions: <summary>.
                    Q1 Smartest Alternative: fundamentally different approach?
                    Q2 Problem Validity: which decision solves a non-existent problem?
                    Q3 Regret Prediction: which decision reversed in 6 months?
                    SendMessage findings to challenger.")

     Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "<same 3 questions>. SendMessage findings to challenger.")

     Agent(subagent_type: "challenger", name: "challenger",
           team_name: "<team>", run_in_background: true,
           prompt: "Wait for cross-family findings. Answer 3 questions yourself.
                    Synthesize into single report. SendMessage to user.")
     ```
   - **Cross-family unavailable** → challenger-only (single subagent)
3. Present challenges to user
4. User agrees → reopen topic (back to step 2, scored as revisit)
5. User dismisses → record reason
6. Record in conclusion under `## Doodlestein Review`

### 5. Generate Conclusion

```markdown
---
id: "[same as index]"
title: "[title] — Conclusion"
concluded: YYYY-MM-DD
plan: ""
---

# [Title] — Conclusion

## Decision Summary (Converged)

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | [topic] | [option] | [reason] | high/medium/low |

## Spawned Discussions

| # | Topic | New Discussion | Reason |
|---|-------|----------------|--------|
| 2 | [topic] | [link] | [why decomposed] |

## Deferred Resolutions

| # | Topic | Resolution | Detail |
|---|-------|------------|--------|
| 3 | [topic] | explained | [assumption + revisit trigger] |

## Doodlestein Review
[challenges + user responses]

## Process Metadata
- Rounds: N
- Topics: X total (Y converged, Z spawned, W explained)
- Deferred resolved in Sweep: N
- Revisit cycles: N
- Doodlestein: executed/skipped (cross-family: yes/no)

## Next Steps
→ `/ae:plan` for converged decisions
→ Resolve spawned discussions first if any
```

Update index.md: set `pipeline.discuss: done`, add conclusion link.

### 6. Suggest Next Steps

- All converged, no spawned → "Ready for `/ae:plan`"
- Has spawned discussions → "Resolve sub-discussions first, then `/ae:plan`"

## Principles

- Present one topic at a time
- Decisions recorded in both topic file (detailed) and index.md (summary)
- If one topic's decision affects another, mention it
- Multi-round: no fixed limit, continue until convergence
- **No deferred survives**: every item must be resolved or transformed before conclusion
- Always keep index.md in sync with topic files
