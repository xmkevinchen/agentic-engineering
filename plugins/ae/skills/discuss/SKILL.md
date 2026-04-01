---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted)
argument-hint: "<topic description or discussion directory path>"
---

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.discussions` for any discussion with `status: active` (has pending topics)
2. Found → continue that discussion
3. Not found → check conversation context for a topic being discussed
4. Still nothing → ask user what to discuss

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

### 1. Load Index & Route

Read `$ARGUMENTS/index.md`, parse topic table. Show convergence status:

```
📊 Discussion NNN: N topics
- converged: X ✅
- revisit: Y 🔄
- deferred: Z ⏳
- pending: W
```

Route:
- All converged + no deferred → **go to Doodlestein** (step 5)
- Has revisit → **discuss those next** (step 2)
- Has pending → **discuss those next** (step 2)

### 2. Research ALL Pending/Revisit Topics (Batch)

**Do NOT discuss topics one by one.** Research all pending/revisit topics as a batch first.

For EACH pending or revisit topic:

1. **Read `topic-NN-slug/summary.md` ONLY** — do NOT read previous round files (they are archived)
2. **Independent research (MANDATORY)** — before forming any opinion:
   - Read the actual code/files referenced in the topic
   - Use Explore agent or Grep to investigate relevant patterns, constraints, and precedents
   - If the topic references external systems/projects, read those too
   - Identify at least one insight, risk, or consideration NOT already in the summary
   - If the summary's options are incomplete or wrong based on your research, add/modify options
   - Form your own evidence-based opinion on which option is best and WHY (cite specific files, patterns, or data)

**Anti-pattern**: Reading summary.md and presenting its content back to the user is NOT discussing — it's relaying. The value of this step is YOUR analysis.

### 3. Score & Decide Topics (Batch)

After researching all topics, **check for dependencies first**: if Topic A's decision is prerequisite for Topic B, score A first, then score B using A's decision. Within a batch, respect dependency order.

Score each topic using the **three-state model**:

| Score | When to use | What to record |
|-------|-------------|----------------|
| `converged` | Evidence clearly supports one option, OR you have a defensible preference among close options | `decision`, `rationale` (must cite evidence), `reversibility` + `reversibility_basis` |

**Reversibility observation protocol**: When filling `reversibility` (high/medium/low), also record `reversibility_basis` — a one-line explanation of WHY this level was chosen (e.g., "high — can revert by changing one config", "low — changes DB schema used by 3 services"). This is an observation experiment to determine if the reversibility field adds decision value. Data will be reviewed after 2-3 discussions.
| `revisit` | You lack specific information needed to decide — state WHAT is missing | `revisit_reason` (must be specific: "need X data" or "depends on Y decision") |
| `deferred` | Can be postponed, but MUST resolve before discussion ends | `deferred_reason` (why postpone + what would unblock) |

**Decision authority rules:**

- **TL decides autonomously (DEFAULT)** — most topics. Evidence supports an option → decide it, record rationale, move on.
- **Escalate to user (EXCEPTION)** — only when:
  - Low reversibility AND genuine ambiguity (evidence doesn't favor either side)
  - You need domain context only the user has (business priorities, team constraints)
  - Topic explicitly affects user's workflow or preferences

**The default is to decide, not to ask.** Present autonomous decisions as FYI, not questions. User can override if they disagree.

### 4. Present Results to User

After scoring all topics, present the batch result:

```
📊 Round N Results:
- Topic 1: [title] → converged: [decision]. Evidence: [one-line].
- Topic 2: [title] → converged: [decision]. Evidence: [one-line].
- Topic 3: [title] → ⚠️ ESCALATED — [why you can't decide]. Options: A/B/C. My leaning: [X].
- Topic 4: [title] → revisit: [what info is missing].
- Topic 5: [title] → deferred: [why postpone].
```

For escalated topics: use `AskUserQuestion` with your research findings + the genuine dilemma + YOUR leaning. Options include:
- The listed options (A, B, C...)
- "需要更多分析" (→ revisit)
- "这个问题需要拆分" (→ deferred, spawn in Sweep)
- "稍后再议" (→ deferred)

### 5. Record & Update

For each topic decided in this round:

1. **Quality check** — rationale must cite specific files, code, or data (not "综合考虑选 A"). High-impact (low reversibility) needs stronger evidence. Weak rationale → force revisit.
2. **Write round file**: `topic-NN-slug/round-NN.md` with discussion content + outcome
3. **Update summary.md**: status, Round History row, Current Status (concise, not full discussion)
4. **Update index.md** topic table
5. Show updated convergence status

### 6. Multi-round (if revisit topics exist)

If any topics are `revisit` after this round:
- For each revisit topic, address the specific `revisit_reason` — get the missing info, try a different angle
- New round → repeat from step 2 (research → score → present → record)
- No fixed round limit — continue until all topics are converged or deferred (no more revisit)

### 7. Sweep: Resolve All Deferred

**Triggered when**: all topics are converged or deferred (zero revisit remaining).

**Rule: No deferred item survives the Sweep.** But "no deferred survives" does NOT mean "force converge." If nothing has changed since deferral, forced converge with unchanged information is worse than an honest explain+assume.

**Decision tree** for each deferred item:

```
Can you obtain the missing info in this session?
  → YES: revisit (return to Step 2, not Sweep)
  → NO: Is there a reasonable assumption to proceed?
    → YES: explain+assume (plannable with caveat)
    → NO: Is this an independent design problem needing deep discussion?
      → YES: spawn new discussion
      → NO: spawn as backlog (execution problem)
```

| Resolution | When | Output |
|------------|------|--------|
| **Converge now** | New info arrived OR revisit resolved it | `converged` with decision + rationale |
| **Spawn new discussion** | Independent design problem needing deep-dive | Create sub-discussion dir, link from index.md. Note: this creates the directory and links it but does not auto-execute — user initiates separately. |
| **Spawn as backlog** | Execution problem, not a design problem | Write to `output.backlog` as `BL-NNN-slug.md` |
| **Explain + assume** | Missing info unlikely to change decision, OR delay cost > assumption risk. If assumption is load-bearing AND high-stakes → spawn discussion instead. | Record assumption + revisit trigger; plannable with caveat |

**TL resolves autonomously first** — same rules as step 3. Only escalate to user when TL genuinely can't resolve.

**After each resolution**: update summary.md frontmatter `status` to `converged` (for converge now / explain+assume / backlog) or leave `deferred` (for spawn new discussion — it's tracked elsewhere). Update index.md topic table Status column. The `explained` resolution type maps to `status: converged` in frontmatter (it's plannable, just with a caveat).

Record each resolution:
```
## Deferred Resolution: [topic title]
- Resolution: [converged / new_discussion / backlog / explained]
- Detail: [decision / link / backlog item / assumption + revisit trigger]
```

**After Sweep: zero deferred, zero revisit.** Every output is either plannable or spawned into a trackable unit.

**Landing rule**: Every discussion output has exactly two possible destinations:
- **Plannable** → feeds into `/ae:plan`
- **New discussion** → enters next discussion cycle

There is no third state. Nothing is "recorded but not acted on."

### 8. Doodlestein Challenge

After Sweep, all topics resolved. Before generating conclusion:

1. Compile: topic titles + decisions + one-line rationale each
2. Check cross-family availability (`cross_family` in pipeline.yml):
   - **Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.
   - **Cross-family available** → Agent Team with **role reversal** (Attacker/Defender pattern):
     ```
     TeamCreate(team_name: "<discussion>-doodlestein")

     Agent(subagent_type: "challenger", name: "challenger",
           team_name: "<team>", run_in_background: true,
           prompt: "You are the ATTACKER. Your goal is to find flaws in these decisions: <summary>.
                    Attack with 3 questions:
                    Q1 Smartest Alternative: fundamentally different approach?
                    Q2 Problem Validity: which decision solves a non-existent problem?
                    Q3 Regret Prediction: which decision reversed in 6 months?
                    SendMessage your attacks to gemini-proxy (the Defender).
                    IMPORTANT: STAY IN THE TEAM. Wait for defense response to synthesize final report.")

     Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "You are the DEFENDER. Wait for challenger's attacks on these decisions: <summary>.
                    Defend each decision with code evidence. If an attack is genuinely strong, acknowledge it.
                    SendMessage your defense to challenger.
                    IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

     Agent(subagent_type: "codex-proxy", name: "codex-proxy",
           team_name: "<team>", run_in_background: true,
           prompt: "You are the cross-family OBSERVER. Read these decisions: <summary>.
                    Provide independent perspective on the attack/defense exchange.
                    SendMessage observations to challenger for synthesis.
                    IMPORTANT: STAY IN THE TEAM. Do NOT exit.")
     ```
   - **Cross-family unavailable** → challenger-only (single subagent)
   - **Skip conditions**: If only 1 topic with high reversibility → may skip, but MUST record: `Doodlestein: skipped (reason: single low-impact topic)`
3. Present challenges to user
4. User agrees with challenge → reopen topic (back to step 2, scored as revisit)
5. User dismisses → record reason
6. Record in conclusion under `## Doodlestein Review`

### 9. Generate Conclusion

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
| (only if Sweep spawned sub-discussions) |

## Deferred Resolutions

| # | Topic | Resolution | Detail |
|---|-------|------------|--------|
| (only if Sweep resolved deferred items) |

## Doodlestein Review
[challenges + user responses, or "skipped (reason)"]

## Reversibility Observation
Record for each converged topic:
- Topic N: reversibility=[level], basis=[one-line reason], influenced_decision=[yes/no/unclear]
After 2-3 discussions with this data, evaluate: does reversibility assessment add information value to decisions? If no clear value → remove the field.

## Process Metadata
- Rounds: N
- Topics: X total (Y converged, Z spawned, W explained)
- Autonomous decisions: N (TL decided without user escalation)
- User escalations: N
- Deferred resolved in Sweep: N
- Revisit cycles: N
- Doodlestein: executed/skipped (cross-family: yes/no)

## Next Steps
→ `/ae:plan` for converged decisions
→ Resolve spawned discussions first if any
```

Update index.md: set `pipeline.discuss: done`, add conclusion link.

### 10. Suggest Next Steps

- All converged, no spawned → "Ready for `/ae:plan`"
- Has spawned discussions → "Resolve sub-discussions first, then `/ae:plan`"

## Agent Teams Protocol

When using Agent Teams for discussion:
- **Persistence**: ALL agent spawn prompts MUST include: "IMPORTANT: STAY IN THE TEAM. Do NOT exit. Wait for follow-up rounds."
- **Multi-round**: For Round 2+, message existing agents — do NOT spawn new ones. Agents retain their Round 1 context.
- **Challenger drives convergence**: Challenger should autonomously initiate Round 2 challenges when it identifies disagreements, without waiting for TL.

## Principles

- **Batch, don't serialize**: Research and decide all topics together, not one by one
- **Decide, don't ask**: TL resolves autonomously by default, escalates only when genuinely stuck
- **No deferred survives**: every item must be resolved or transformed before conclusion
- **Evidence, not opinion**: decisions cite specific files, code, data — not "综合考虑"
- **Landing rule**: every output is either plannable or a new discussion — nothing sits idle
- If one topic's decision affects another, note the dependency
- Multi-round: no fixed limit, continue until convergence
- Always keep index.md in sync with topic files
