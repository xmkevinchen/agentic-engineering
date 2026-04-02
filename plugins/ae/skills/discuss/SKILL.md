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
Setup → Spawn Team → Discussion Rounds → Doodlestein → Sweep → Conclusion → Shutdown
                          ↑                    │
                          └── revisit topics ───┘
```

Read `pipeline.yml` → `output.discussions` for the base directory.

## File Formats

### Topic directory structure

```
topic-NN-slug/
  summary.md       # Current state — agent reads ONLY this each round
  round-01.md      # Round discussion record (archived after round ends)
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
[Why this decision matters, what it affects, what breaks if we get it wrong]

## Constraints
[Hard constraints — system limitations, compatibility requirements, resource limits, prior decisions]

## Key Questions
[What needs to be answered to make this decision — framed as questions, not options]
```

**DO NOT pre-populate options (A/B/C) in summary.md.** Options emerge from team discussion. The template frames the problem; the team finds the solution.

**round-NN.md** (archived after each round — not re-read by agents):

```markdown
---
round: NN
date: YYYY-MM-DD
score: pending/converged/revisit/deferred
---

# Round NN

## Discussion
[Team discussion content, key arguments, evidence cited]

## Outcome
- Score: [converged/revisit/deferred]
- Decision: [if converged]
- Revisit reason: [if revisit]
- Deferred reason: [if deferred]
```

### index.md

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

## Step 1. Setup

1. **Resolve discussion directory**:
   - `$ARGUMENTS` points to existing directory → load `index.md`
   - `$ARGUMENTS` is a topic description → check `<output.discussions>` for related directory
     - Found → add topics to that directory
     - Not found → create `<output.discussions>/NNN-slug/`
2. **If new discussion**: create `index.md` with Problem Statement
3. **If existing**: show convergence status:
   ```
   📊 Discussion NNN: N topics
   - converged: X ✅  revisit: Y 🔄  deferred: Z ⏳  pending: W
   ```
4. **Route**:
   - All converged + no deferred → go to Doodlestein (step 5)
   - Has revisit or pending → spawn/continue team (step 2)

## Step 2. Spawn Discussion Team (once, persists until Conclusion)

**The core of ae:discuss is team discussion.** One team lives for the entire discussion — only add agents, never remove.

If the team already exists (resuming), skip to step 3. Otherwise:

1. Read all pending/revisit `topic-NN-slug/summary.md` files
2. Compile a **topic brief**: Context + Constraints + Key Questions from each summary
3. **Select agents using the Agent Selection Reference** skill:
   - Match topic content against the Selection Table to pick core agents
   - Cross-family: read `cross_family` config from pipeline.yml, assign specialized review angles per Cross-family Prompt Reference
   - **Multiple instances of the same backend are allowed** — e.g., codex-as-researcher + codex-as-architect with different review angles
   - Show selected team to user before launching (per Rule 5)
4. Spawn the team:

**Debate model**: TL = moderator/judge, Host = proposer (proposer), other agents = opposition (challengers).

```
TeamCreate(team_name: "<discussion>-council")

# Host — proposer (proposer). Has opinions, argues FOR positions.
Agent(subagent_type: "general-purpose", name: "host",
      team_name: "<team>", run_in_background: true,
      prompt: "You are the HOST (proposer) for: <discussion title>.
               Topics: <topic brief>

               You PROPOSE and DEFEND positions. You are NOT neutral.

               Round 1: Research independently. Read code, find evidence.
               Form your position on each topic. SendMessage your proposals
               (with evidence) to Session TL.

               Round 2+: Defend your positions against challengers.
               Use structured output per ae:agent-teams protocol:
               ## Position: FOR
               ### Claims (each with file:line evidence)
               ### Conceded Points (where opposition is right — be honest)
               Concede only when presented with stronger evidence, not social pressure.

               IMPORTANT: STAY IN THE TEAM for the entire discussion lifecycle. Do NOT exit.")

# Challenger agents — opposition (opposition). Dynamic roles per Agent Selection Reference.
Agent(subagent_type: "<codex-proxy|gemini-proxy|general-purpose>",
      name: "<role-name>",  # e.g., "code-researcher", "architect", "security-expert"
      team_name: "<team>", run_in_background: true,
      prompt: "You are <ROLE> — a CHALLENGER (opposition) in this discussion.
               Your expertise: <role-specific focus>.
               Topics: <topic brief>

               Round 1: Research independently. Read code, find evidence, form your
               OWN position. SendMessage your findings to Session TL.
               Do NOT read other agents' findings yet.

               Round 2+: Challenge the Host's proposals. Attack weak points.
               Use structured output per ae:agent-teams protocol:
               ## Position: AGAINST (or INDEPENDENT if you agree with Host on some topics)
               ### Claims (each with file:line evidence)
               ### Conceded Points (where Host is right — be honest)
               Defend your positions when challenged — strong opinions are valuable.
               Concede only when presented with stronger evidence, not social pressure.

               IMPORTANT: STAY IN THE TEAM for the entire discussion lifecycle. Do NOT exit.")
```

Apply Proxy Timeout Protocol from Agent Selection Reference.

**Adding agents mid-discussion**: If new topics emerge or existing debate reveals a missing perspective, TL spawns additional agents into the existing team. Never remove agents — strong disagreement is signal, not noise.

### 3. Discussion Rounds (TL moderates)

**TL is the moderator.** TL drives rounds, routes messages, identifies convergence. Host and challengers debate; TL judges.

**Round 1 — Independent Research** (no cross-talk):
- All agents (Host + challengers) research topics independently
- Each forms their own position with evidence
- All report findings to TL (not to each other)
- TL does NOT share findings between agents yet

**Round 2 — Debate** (TL opens the floor):
- TL compiles all Round 1 positions, highlights disagreements
- TL sends compiled summary to all agents: "Here are the positions. Debate."
- Host defends proposals, challengers attack — using `ae:agent-teams` Debate Mode structured output:
  Claims with evidence (file:line) + Conceded Points + responses to opponent claims
- Agents argue directly with each other via TL routing
- Sub-questions identified and debated
- See `ae:agent-teams` protocol for full structured output schema and cross-examination protocol

**Round 3+ — TL drives convergence**:
- TL identifies topics where evidence clearly supports one side → marks converging
- Topics still contested → TL runs cross-examination per `ae:consensus` protocol:
  extract top claims from each side, demand direct responses
- Sub-questions resolved in-team — do NOT bubble up to user
- Continue until all topics have either clear direction or genuine dilemma

**TL compiles synthesis** when rounds complete:
- Per topic: recommendation backed by debate evidence, dissenting views, resolved sub-questions
- Genuine dilemmas: team split with comparable evidence even after structured debate

### 4. TL Scores (Batch)

Based on debate evidence:

1. **Check for dependencies**: if Topic A's decision is prerequisite for Topic B, score A first
2. **Score each topic** using the three-state model:

| Score | When to use | What to record |
|-------|-------------|----------------|
| `converged` | Team evidence clearly supports one direction | `decision`, `rationale` (cite team evidence), `reversibility` + `reversibility_basis` |
| `revisit` | Team identified missing information needed to decide | `revisit_reason` (specific: "need X data") |
| `deferred` | Can be postponed, but MUST resolve before discussion ends | `deferred_reason` (why postpone + what would unblock) |

**Reversibility observation protocol**: record `reversibility_basis` — one-line explanation of WHY this level was chosen.

**Decision authority rules:**

- **TL decides autonomously (DEFAULT)** — team evidence supports a direction → decide it, cite team findings.
- **Escalate to user (EXCEPTION)** — only when:
  - Low reversibility AND team is genuinely split
  - Domain context only the user has
  - Topic explicitly affects user's workflow or preferences

**The default is to decide, not to ask.** Present autonomous decisions as FYI backed by team evidence.

### 5. Present Results to User & Record

Present the batch result **with team evidence**:

```
📊 Round N Results (Team: host + <role-agents>):

- Topic 1: [title] → converged: [decision].
  Evidence: [key finding that drove the decision]

- Topic 2: [title] → ⚠️ ESCALATED — team split: [role-A] argues X (evidence), [role-B] argues Y (evidence).
  My leaning: [X]. What's your call?

- Topic 3: [title] → revisit: [what info team couldn't find].
```

For escalated topics: use `AskUserQuestion` with team findings + genuine dilemma + YOUR leaning.

**Record** for each topic decided:
1. **Quality check** — rationale must cite team evidence, not "hand-wavy reasoning". Weak rationale → force revisit.
2. **Write round file**: `topic-NN-slug/round-NN.md` with team discussion content + outcome
3. **Update summary.md**: status, Round History row, Current Status
4. **Update index.md** topic table

**Multi-round**: If any topics are `revisit`:
- SendMessage to existing team (Host + all agents still alive, with full context)
- Host runs another round addressing the specific `revisit_reason`
- TL scores again after team reports back
- Continue until all topics converged or deferred

### 6. Doodlestein Challenge

**Triggered when**: all topics converged or deferred (zero revisit remaining). Before Sweep and Conclusion.

Per `ae:agent-teams` Doodlestein Protocol. Three fresh agents, each answering ONE focused question.

1. Compile: topic titles + decisions + rationale + key evidence + summary of debate
2. **Spawn all three Doodlestein agents INTO the existing team simultaneously**:

```
Agent(subagent_type: "doodlestein-strategic", name: "doodlestein-strategic",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<compiled decisions + debate summary + file paths to read>
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-adversarial", name: "doodlestein-adversarial",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<compiled decisions + debate summary + file paths to read>
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-regret", name: "doodlestein-regret",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<compiled decisions + debate summary + file paths to read>
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")
```

3. Each Doodlestein agent SendMessage findings to TL
4. **TL moderates response** (NOT Host — conflict of interest):
   - TL routes challenges to relevant team members for response
   - Host defends decisions (as proposer), opposition may agree or disagree with Doodlestein
   - If a challenge is valid → TL opens new debate rounds (all agents participate)
   - If refuted with evidence → TL records the exchange
   - Continue until all Doodlestein issues resolved

5. TL processes:
   - Challenge resolved → record in Doodlestein Review
   - Challenge opened valid concern → topic reverts to `revisit`, back to step 3
   - Genuine dilemma → escalate to user

### 7. Sweep: Resolve All Deferred

**Triggered when**: all topics converged or deferred, Doodlestein complete.

**Rule: No deferred item survives the Sweep.** Every deferred item MUST have a result before Conclusion.

The existing team (including Doodlestein agents) participates in Sweep.

**Decision tree** for each deferred item:

```
Can the team obtain the missing info?
  → YES: SendMessage to team, run research round → revisit (back to step 3)
  → NO: Is there a reasonable assumption to proceed?
    → YES: explain+assume (plannable with caveat)
    → NO: Independent design problem?
      → YES: spawn new discussion
      → NO: spawn as backlog
```

| Resolution | When | Output |
|------------|------|--------|
| **Converge now** | Team found new info | `converged` with decision + rationale |
| **Spawn new discussion** | Independent deep-dive needed | Create sub-discussion dir, link from index.md |
| **Spawn as backlog** | Execution problem, not design | Write to `output.backlog` |
| **Explain + assume** | Delay cost > assumption risk | Record assumption + revisit trigger |

**TL resolves autonomously first.** Only escalate to user when TL genuinely can't resolve.

Update summary.md and index.md for each resolution.

**After Sweep: zero deferred, zero revisit.** Every output is plannable or spawned.

### 8. Generate Conclusion

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
| 1 | [topic] | [decision] | [evidence-based reason] | high/medium/low |

## Doodlestein Review
[Challenges raised, how each was resolved, any topics reopened]

## Spawned Discussions
| # | Topic | New Discussion | Reason |
|---|-------|----------------|--------|
| (only if Sweep spawned sub-discussions) |

## Deferred Resolutions
| # | Topic | Resolution | Detail |
|---|-------|------------|--------|
| (only if Sweep resolved deferred items) |

## Team Composition
| Agent | Role | Backend | Joined |
|-------|------|---------|--------|
| host | Proposer | Claude | Start |
| <name> | <role> | codex/gemini/claude | Start/Round N/Doodlestein |

## Process Metadata
- Discussion rounds: N (team-internal rounds not counted)
- Topics: X total (Y converged, Z spawned, W explained)
- Autonomous decisions: N
- User escalations: N
- Doodlestein challenges: N raised, M resolved, K reopened topics
- Deferred resolved in Sweep: N

## Next Steps
→ `/ae:plan` for converged decisions
→ Resolve spawned discussions first if any
```

Update index.md: set `pipeline.discuss: done`, add conclusion link.

### 9. Team Shutdown & Next Steps

**Shutdown the team ONLY after Conclusion is written.**

- All converged, no spawned → "Ready for `/ae:plan`"
- Has spawned discussions → "Resolve sub-discussions first, then `/ae:plan`"

## Principles

- **Debate model**: TL = moderator/judge (moderates, judges), Host = proposer (proposes, defends), other agents = opposition (challenges). Host must NEVER moderate or synthesize — that's TL's job.
- **Team debates, TL judges**: The value of ae:discuss is multi-agent debate with code evidence. If the team didn't debate it, don't present it to the user.
- **One team, one lifecycle**: Spawn once, add agents as needed, never remove. Shutdown only at Conclusion.
- **Strong opinions welcome**: Agents with dissenting views are assets. Never remove an agent for disagreeing. Heated debate produces better decisions.
- **Dynamic composition**: Agent roles are determined by discussion content, not hardcoded. Multiple instances of the same backend (codex, gemini) with different roles are encouraged.
- **Discussion before user**: Team runs minimum 3 internal rounds (research → debate → converge). Sub-questions resolved internally. Only genuine dilemmas reach the user. Presenting shallow A/B/C options is a failure mode.
- **Batch, don't serialize**: All topics discussed together, not one by one
- **Decide, don't ask**: TL resolves autonomously by default, escalates only when genuinely stuck
- **No deferred survives**: every item must have a result before Conclusion
- **Evidence, not opinion**: decisions cite specific files, code, data — not "hand-wavy reasoning"
- **Landing rule**: every output is plannable or a new discussion — nothing sits idle
- Topic dependencies: if one decision affects another, note it
- Always keep index.md in sync with topic files
