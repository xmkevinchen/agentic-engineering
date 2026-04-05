---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted)
argument-hint: "<topic description or discussion directory path>"
user-invocable: true
---

**Protocol Map** — if detail for any step is missing below, read this SKILL.md file directly before proceeding.
Steps: 1.Setup → 2.Spawn Team → 3.Discussion Rounds → 4.Consensus Verification → 5.TL Scores → 6.Present & Record → 7.Doodlestein → 8.Sweep → 9.Conclusion → 10.Shutdown

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

File format templates are in the Appendix at the end of this file.

## Pre-check

1. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

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
   - All converged + no deferred → go to Doodlestein (step 7)
   - Has revisit or pending → spawn/continue team (step 2)

## Step 2. Spawn Discussion Team (once, persists until Conclusion)

**The core of ae:discuss is team discussion.** One team lives for the entire discussion — only add agents, never remove.

**DO NOT delete the team between topics, after scoring, or before Doodlestein.** The team persists from Step 2 through Step 9 (Conclusion). Doodlestein agents join this team in Step 7 and original participants must be alive to respond to challenges. Deleting the team early breaks the Doodlestein challenge-response cycle.

If the team already exists (resuming), skip to step 3. Otherwise:

1. Read all pending/revisit `topic-NN-slug/summary.md` files
2. Compile a **topic brief**: Context + Constraints + Key Questions from each summary
3. **Select agents using the Agent Selection Reference** skill:
   - Match topic content against the Selection Table to pick core agents
   - Cross-family: read `cross_family` config from pipeline.yml, assign specialized review angles per Cross-family Prompt Reference
   - **Multiple instances of the same backend are allowed** — e.g., codex-as-researcher + codex-as-architect with different review angles
   - Show selected team to user before launching (per Rule 5)
4. Spawn the team:

**Discussion Mode per `ae:agent-teams` protocol**: TL = moderator, all agents = equal participants. No forced proposer/opposition.

```
TeamCreate(team_name: "<discussion>-council")

# All agents are equal participants — dynamic roles per Agent Selection Reference.
Agent(subagent_type: "<per agent-selection>",
      name: "<role-name>",  # e.g., "architect", "code-researcher", "security-expert"
      team_name: "<team>", run_in_background: true,
      prompt: "You are <ROLE> in a design discussion: <discussion title>.
               Your expertise: <role-specific focus>.
               Topics: <topic brief>

               Round 1: Research independently. Read code, find evidence, form your
               position on each topic. SendMessage findings to Session TL.
               Do NOT read other agents' findings yet.

               Round 2+: Respond to other agents' findings. Agree, build on,
               or challenge with evidence. Evolving your position based on new
               evidence is expected — not failure.

               Use structured output per ae:agent-teams Discussion Mode:
               ## Findings (with file:line evidence)
               ## Agreements (with other agents)
               ## Disagreements (with evidence)
               ## Open Questions

               IMPORTANT: STAY IN THE TEAM for the entire discussion lifecycle. Do NOT exit.")
```

**Consensus escalation**: When a specific topic is deeply contested and normal discussion cannot resolve it, TL escalates that topic to `ae:consensus` (Debate Mode, forced FOR/AGAINST stances) within the existing team. This is per-topic, not a global mode switch.

Apply Proxy Timeout Protocol from Agent Selection Reference.

**Adding agents mid-discussion**: If new topics emerge or existing debate reveals a missing perspective, TL spawns additional agents into the existing team. Never remove agents — strong disagreement is signal, not noise.

### 3. Discussion Rounds (TL moderates)

**TL is the moderator.** TL drives rounds, routes messages, highlights disagreements, identifies convergence. Per `ae:agent-teams` Discussion Mode.

**Round 1 — Independent Research** (no cross-talk):
- All agents research topics independently
- Each forms their own position with evidence
- All report findings to TL (not to each other)
- TL does NOT share findings between agents yet

**Round 2 — Share & Explore**:
- TL compiles all Round 1 findings, highlights disagreements and gaps
- TL sends compiled summary to all agents
- Agents respond to each other's findings — agree, build on, or challenge with evidence
- Positions may evolve based on new evidence — this is expected
- Use Discussion Mode structured output: Findings + Agreements + Disagreements + Open Questions

**Round 3+ — Convergence**:
- TL pushes converging topics toward conclusion
- Topics with genuine disagreement get more rounds
- **Unanimous Agreement Gate**: when all agents agree on a topic direction, TL runs UAG per `ae:agent-teams` Discussion Mode — structured falsification question, agents must search for counterexamples. Passed UAG = genuine convergence.
- Sub-questions resolved in-team — do NOT bubble up to user
- Continue until all topics have either clear direction (UAG passed) or genuine disagreement

**TL compiles synthesis** when rounds complete:
- Per topic: direction backed by evidence, UAG result, dissenting views, resolved sub-questions

### 4. Consensus Verification

TL runs consensus verification on topics where a direction has formed, to stress-test the conclusion before marking it converged. This is a quality gate — discussion finds the direction, consensus confirms it holds under adversarial pressure.

**When to trigger** (TL judgment):
- **Run** when: topic involves a design decision, architecture choice, or recommendation that downstream work depends on. Also run when: agents agreed quickly without visible challenge (potential groupthink).
- **Skip** when: topic is purely informational (e.g., "what's the current state of X"), OR all agents independently reached the same conclusion with strong evidence from different angles (genuine convergence, not groupthink).
- **When in doubt**: run it. False positive (unnecessary verification) wastes some tokens. False negative (skipped verification on a bad decision) wastes real work downstream.

For each topic TL selects for verification:
1. TL temporarily assigns agents to forced stances: one = advocate (FOR the direction), another = critic (AGAINST)
2. Run `ae:consensus` Debate Mode protocol within the same team: structured output (Claims + Evidence + Conceded Points), cross-examination
3. **Confirmed** → topic converged, direction validated under adversarial pressure
4. **Overturned** → back to Discussion rounds (step 3), explore further with new evidence
5. **Deadlocked** (3 cross-exam rounds, still split) → TL decides by evidence preponderance, or marks genuine dilemma and escalates to user

### 5. TL Scores (Batch)

Based on discussion + consensus verification evidence:

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

### 6. Present Results to User & Record

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

### 7. Doodlestein Challenge

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
4. **TL moderates response** per `ae:agent-teams` Doodlestein Protocol:
   - TL routes challenges to ALL team members simultaneously
   - All agents respond — no agent's response is weighted higher than others
   - If a challenge is valid → TL opens new discussion rounds (all agents participate)
   - If refuted with evidence → TL records the exchange
   - Continue until all Doodlestein issues resolved

5. TL processes:
   - Challenge resolved → record in Doodlestein Review
   - Challenge opened valid concern → topic reverts to `revisit`, back to step 3
   - Genuine dilemma → escalate to user

### 8. Sweep: Resolve All Deferred

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
| host | TL (moderator) | Claude | Start |
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

### 10. Team Shutdown & Next Steps

**Shutdown the team ONLY after Conclusion is written.**

- All converged, no spawned → "Ready for `/ae:plan`"
- Has spawned discussions → "Resolve sub-discussions first, then `/ae:plan`"

## Principles

- **Discussion Mode**: TL = moderator, all agents = equal participants. No forced proposer/opposition. Positions evolve based on evidence. Per `ae:agent-teams` Discussion Mode.
- **Team explores, TL synthesizes**: The value of ae:discuss is multi-agent collaborative exploration with code evidence. If the team didn't explore it, don't present it to the user.
- **Consensus verification**: Topics with decisions get stress-tested via temporary Debate Mode (forced FOR/AGAINST) before being marked converged. Discussion finds the direction, consensus confirms it.
- **One team, one lifecycle**: Spawn once, add agents as needed, never remove. Shutdown only at Conclusion.
- **Strong opinions welcome**: Agents with dissenting views are assets. Genuine disagreement is valuable signal.
- **Dynamic composition**: Agent roles determined by discussion content via `ae:agent-selection`. Multiple instances of same backend with different roles encouraged.
- **Discussion before user**: Team runs minimum 2 rounds (research → explore). Sub-questions resolved internally. Only genuine dilemmas reach the user.
- **Batch, don't serialize**: All topics discussed together, not one by one
- **Decide, don't ask**: TL resolves autonomously by default, escalates only when genuinely stuck
- **No deferred survives**: every item must have a result before Conclusion
- **Evidence, not opinion**: decisions cite specific files, code, data — not hand-wavy reasoning
- **Landing rule**: every output is plannable or a new discussion — nothing sits idle
- Topic dependencies: if one decision affects another, note it
- Always keep index.md in sync with topic files

---

## Appendix: File Formats

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
