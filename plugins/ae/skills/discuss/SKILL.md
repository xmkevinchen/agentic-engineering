---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted)
argument-hint: "<topic description or discussion directory path>"
---

# /ae:discuss — Design Discussion

Start a structured design discussion for: **$ARGUMENTS**

## Mode Detection

- **Continue mode**: if `$ARGUMENTS` points to an existing discussion directory, load index.md and continue pending topics.
- **Create mode**: otherwise, treat $ARGUMENTS as a topic description — research and create a new discussion.

Read `pipeline.yml` → `output.discussions` (default: `docs/discussions/`) for the base directory.

## Create Mode

### 1. Find or Create Discussion Directory

Check `<output.discussions>` for an existing related directory (e.g., from a prior `/ae:analyze`).
- **Exists**: add topics to that directory.
- **New**: find the highest existing number, take next sequential (zero-padded 3 digits). Create `<output.discussions>/NNN-slug/`.

### 2. Research Codebase

Use Explore agent to investigate related modules, patterns, and constraints. If `analysis.md` exists in the same directory, use its findings as input.

### 3. Identify Discussion Topics

Find 3-6 key decision points. Each should be a genuine choice with trade-offs.

### 4. Create Topic Files

For each topic, create `topic-NN-slug.md`:

```markdown
---
id: "NN"
title: "[topic title]"
status: pending          # pending → discussing → decided
created: YYYY-MM-DD
decision: ""
rationale: ""
---

# Topic: [title]

## Context
[Why this decision is needed, what it affects]

## Options

### A: [option name]
[Description]
- **Pros**: X, Y
- **Cons**: Z

### B: [option name]
[Description]
- **Pros**: X, Y
- **Cons**: Z

### C: [option name]
[Description]
- **Pros**: X, Y
- **Cons**: Z

## Recommendation
[Which option and why, based on codebase analysis]
```

### 5. Create or Update index.md

Create (or update existing) `index.md` topic registry:

```markdown
---
id: "NNN"
title: "[feature/topic title]"
status: active
created: YYYY-MM-DD
pipeline:
  analyze: skipped       # or "done" if analysis.md exists
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [relevant, tags]
---

# [Title]

[One-sentence description]

## Problem Statement
[What needs to be solved, why]

## Current State
[Relevant codebase findings with file path references]

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | [Topic A] | [topic-01-slug.md](topic-01-slug.md) | pending | — |
| 2 | [Topic B] | [topic-02-slug.md](topic-02-slug.md) | pending | — |

## Documents
- [Analysis](analysis.md) *(if exists)*
- [Conclusion](conclusion.md) *(generated after all topics decided)*
- [Plan](../../milestones/vX.X.X/xxx.md) *(linked after plan creation)*
```

### 6. Enter Discussion (Continue Mode)

## Continue Mode

### 1. Load Index

Read `$ARGUMENTS/index.md`, parse topic table.
- If all topics decided, check if conclusion.md exists. If yes, done. If no, generate it.
- Identify pending topics.
- Show summary: N total, M decided, K pending.

### 2. Discuss Pending Topics One by One

For each pending topic:

1. Read topic file (e.g., `topic-01-slug.md`)
2. Present: context, options, recommendation
3. Use `AskUserQuestion` to collect user's choice — list options
4. If user needs more analysis, use appropriate agent
5. **Decision quality self-check** before recording:
   - Does the decision have a clear rationale? (not "feels right" — specific reasoning)
   - For high-impact decisions: mark `reversibility: high/medium/low` in frontmatter
   - What evidence supports this choice? (codebase analysis, prior art, data — record in rationale)
6. Update topic file:
   - Set frontmatter `status: decided`, `decision: "[choice]"`, `rationale: "[reason]"`, `reversibility: "high|medium|low"`
7. Update `index.md` topic table: mark status decided, fill decision column
8. Move to next topic

Allow skipping (keep pending) and revisiting decided topics.

### 3. Doodlestein Challenge

After all topics decided but BEFORE generating conclusion:

1. Compile a summary: topic titles + decisions + one-line rationale each (do NOT include the full discussion process)
2. Check cross-family availability (`cross_family` in pipeline.yml):
   - **Cross-family available** → create Agent Team:
     ```
     TeamCreate(team_name: "<discussion>-doodlestein")

     Agent(subagent_type: "codex-proxy", name: "codex-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "Answer these 3 questions about these decisions: <summary>.
                    Q1 Smartest Alternative: Is there a fundamentally different approach that makes these decisions unnecessary?
                    Q2 Problem Validity: Which decision solves a problem that doesn't actually exist? What evidence would prove it's real?
                    Q3 Regret Prediction: Which decision will be reversed within 6 months, and why?
                    SendMessage findings to challenger.")

     Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "<same 3 questions with summary>. SendMessage findings to challenger.")

     Agent(subagent_type: "challenger", name: "challenger",
           team_name: "<team>", run_in_background: true,
           prompt: "Wait for codex-proxy and gemini-proxy findings.
                    Also answer the 3 Doodlestein questions yourself.
                    Synthesize all challenges into a single report.
                    SendMessage report to user.")
     ```
   - **Cross-family unavailable** → challenger-only mode (no team, single subagent answers the 3 questions)
3. Present challenges to user via AskUserQuestion
4. For each challenge:
   - User agrees → reopen that topic (go back to step 2)
   - User dismisses with reason → record dismissal
5. Record all challenges and responses in conclusion under `## Doodlestein Review`

### 4. Generate Conclusion

After Doodlestein challenge resolved (or all challenges dismissed):

1. Update `index.md`: set `pipeline.discuss: done`
2. Create `conclusion.md`:

```markdown
---
id: "[same as index]"
title: "[title] — Conclusion"
concluded: YYYY-MM-DD
plan: ""
---

# [Title] — Conclusion

## Decision Summary

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | [topic] | [chosen option] | [brief reason] |

## Key Constraints
[Boundary conditions and limitations derived from above decisions.]

## Next Steps
→ Run `/ae:plan` to generate an execution plan based on these decisions.
  Reference this conclusion: `$ARGUMENTS/conclusion.md`
```

3. Add conclusion link in index.md documents section.

### 4. Suggest Next Steps

Tell the user: all decisions recorded, conclusion saved, suggest running `/ae:plan`.

## Principles

- Present one topic at a time — read from topic file and present
- Decisions recorded in both topic file (detailed) and index.md (summary table)
- If one topic's decision affects another, mention it before presenting the affected topic
- If analysis.md exists in the directory, reference its findings
- Always keep index.md topic table in sync with topic file states
