---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted). Recommended: Sonnet or above
argument-hint: "<topic description or discussion directory path>"
user-invocable: true
model: opus
effort: high
---

**Protocol Map** — if detail for any step is missing below, read this SKILL.md file directly before proceeding.
Steps: 1.Setup → 2.Spawn Team → 3.Discussion Rounds → 4.Consensus Verification → 5.TL Scores → 6.Present & Record → 7.Sweep → 8.Conclusion → 9.Doodlestein (post-conclusion) → 10.Shutdown

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
2. **If new discussion**: create two files in the directory:
   - `index.md` — minimal scaffolding (title, pipeline status, topic list placeholder, links)
   - `framing.md` — **separate file** containing Problem Statement. Describe the problem to be solved; do NOT pre-commit to solution directions, list option A/B/C, or embed specific mechanisms. Framing will be reviewed in Step 1.5 before Round 1 spawns.
3. **If existing**: show convergence status:
   ```
   📊 Discussion NNN: N topics
   - converged: X ✅  revisit: Y 🔄  deferred: Z ⏳  pending: W
   ```
4. **Route**:
   - All converged + no deferred → go to Sweep (step 7) / Conclusion (step 8) / Doodlestein (step 9)
   - Has revisit or pending → Step 1.5 (new discussion or framing changed) or Step 2 (resume)

### 1.5. Round 0 — Framing Review (new discussions only)

Before spawning the team, Round 0 reviews `framing.md` for neutral / focused / open properties. Goal: catch bias anchoring or framing-by-solution before Round 1 agents lock on it.

Applies to **new discussions** and any discussion where `framing.md` was changed. Skip for pure resumes.

1. **Spawn `doodlestein-framing`** as a single-agent one-shot (no team setup required):
   ```
   Agent(subagent_type: "doodlestein-framing",
         name: "doodlestein-framing",
         prompt: "Review framing at <discussion-dir>/framing.md. Evaluate neutral / focused / open per your mandate. SendMessage verdict to team-lead.")
   ```

2. **Wait for verdict** (APPROVED or REVISE).

3. **On APPROVED**: log the verdict in `<discussion-dir>/framing.md` frontmatter (`round_0: approved`, ISO date). Proceed to Step 1.6.

4. **On REVISE**: halt. Present the specific issue + suggested edit to the user. User choices:
   - **Revise**: TL updates `framing.md`, re-runs Round 0
   - **Override**: skip Round 0 for this discussion. Log `round_0: overridden` in frontmatter with user-supplied reason. Proceed to Step 1.6.
   - **Cancel**: abort discussion

5. **Limit**: 3 consecutive REVISE verdicts with no user response → escalate to user (do not keep looping).

**Why Round 0 exists (not a mechanism you can inline into later rounds)**: once Round 1 spawns, agents anchor on whatever framing is provided. Mid-round reviewers (challenger, Doodlestein at conclusion) evaluate within the framing. Round 0 is the only point where framing itself is the object of evaluation, before it infects Round 1 context.

### 1.6. Prior Context (from Mengdie)

Run this step after Round 0 approves framing (Step 1.5) and before spawning the team (Step 2). Query uses the approved `framing.md` content as the search query.

1. Call `memory_search` MCP tool with the discussion topic/problem statement as query
2. If `memory_search` is not available, fails, or returns no results — emit `Prior context: unavailable (tool not registered / no relevant results)` and continue to Step 2
3. If results returned with `degraded` field non-null — annotate results as "(partial — [degraded reason])"
4. Present results under `## Prior Art from Project Knowledge Base` with provenance for each item: `title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`
5. Include prior art in the topic brief compiled for agents in Step 2 — treat as background context, does not constrain discussion

## Step 2. Spawn Discussion Team (once, persists until Conclusion)

**The core of ae:discuss is team discussion.** One team lives for the entire discussion — only add agents, never remove.

**DO NOT delete the team between topics, after scoring, or before Doodlestein.** The team persists from Step 2 through Doodlestein (Step 9). Original participants must be alive in case Doodlestein's review of the conclusion kicks off a new round.

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
               position on each topic. Write your full findings to
               `<discussion-dir>/round-01/<your-agent-name>.md` (you own this file;
               TL does not write it). SendMessage a 3-5 line summary to team-lead
               pointing at the file. Do NOT read other agents' findings yet.

               Round 2+: REQUIRED READING before forming any position:
               <explicit list of per-agent files from prior round, e.g.
                round-01/architect.md, round-01/challenger.md, ...>
               TL synthesis is orientation only — do not derive arguments from
               synthesis. Any claim about a peer's position must cite the
               per-agent file and specific line numbers.
               Write your Round N findings to `<discussion-dir>/round-NN/<your-name>.md`.

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

**Per-agent files are the primary artifact.** Each agent writes `round-NN/<agent-name>.md` themselves in every round. TL does NOT author these files and does NOT paraphrase their content into synthesis. Synthesis is an index/orientation layer on top of the per-agent files, not a replacement for them.

**Round 1 — Independent Research** (no cross-talk):
- All agents research topics independently
- Each writes full findings to their own `round-01/<name>.md` file
- SendMessage summary to TL pointing at the file (3-5 lines)
- TL does NOT share findings between agents yet

**Round 2 — Share & Explore**:
- TL's Round 2 spawn/send prompt includes REQUIRED READING with explicit list of Round 1 per-agent files
- Agents read peers' `round-01/*.md` directly — not TL synthesis
- Agents respond, cite peer claims by file path + line numbers
- Each writes `round-02/<name>.md`; SendMessage summary

**Round 3+ — Convergence**:
- Same per-agent file pattern continues
- TL pushes converging topics toward conclusion
- **Unanimous Agreement Gate**: when all agents agree on a topic direction, TL runs UAG per `ae:agent-teams` Discussion Mode — structured falsification question, agents must search for counterexamples. Passed UAG = genuine convergence.
- Sub-questions resolved in-team — do NOT bubble up to user
- Continue until all topics have either clear direction (UAG passed) or genuine disagreement

**TL synthesis format (mandatory 4 fields, written in each round's `round-NN/synthesis.md`)**:

1. **Pruned section**: explicit "Pruned: [what], reason: [why]" per item. If nothing pruned this round, write "Pruned: nothing; all inputs advanced" — **empty or missing Pruned section is a protocol violation**.
2. **Of-framing disposition**: list every of-framing challenge raised this round + TL's disposition (integrate / reject-with-reason / defer-to-followup-BL). TL fills this; do NOT rely on agent self-tagging of challenges.
3. **Verification artifact**: any claim of "verified / computed / checked" must cite a concrete artifact (file path, script output, document section). No artifact → mark `unvalidated`; do not mark such claims converged.
4. **Frame-challenge disappearance self-check**: before writing synthesis, compare Round N-1's of-framing markers against Round N — did any silently disappear without explicit resolution? regex / keyword comparison is acceptable tooling. Record the check outcome in synthesis.

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

### 7. Sweep: Resolve All Deferred

**Triggered when**: all topics converged or deferred (zero revisit remaining).

**Rule: No deferred item survives the Sweep.** Every deferred item MUST have a result before Conclusion.

The existing team participates in Sweep.

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
| **Spawn as backlog** | Execution problem, not design | Write to `output.backlog/unscheduled/` (new BLs land unscheduled; sprint assignment via `/ae:roadmap plan`) |
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
entities: []
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

**Entity extraction (required)**: Before writing the conclusion, extract entities from the Decision Summary Topic column for the `entities:` frontmatter field. For each topic: produce the full compound form (kebab-case) + individual tokens. Single-word topics → one entity. Multi-word → tokens + full compound only (no partial compounds). Filter stopwords and pure numbers. Lowercase, deduplicate. Example: "Auth middleware" → `[auth, middleware, auth-middleware]`.

Update index.md: set `pipeline.discuss: done`, add conclusion link.

### 8.5. Knowledge Capture (to Mengdie)

Run this step after the conclusion is written (Step 8) and before Doodlestein post-conclusion review (Step 9).

Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md) for common rules (max 3 items, atomic units, graceful degradation, conflict handling).

**Skill-specific extraction**:
- One item per **resolved decision** from the Decision Summary table in the conclusion
- Include the Rationale column content (not just the decision text)
- Skip open questions and deferred items
- `source_type`: `conclusion`
- `knowledge_type`: `decisional`
- `entities`: derive from each specific decision, NOT from the broad conclusion frontmatter. Use compound tags specific to the decision (e.g., `rust-tech-stack-selection`, `jwt-rs256-auth`). Avoid single broad tags like `auth`, `database`, `search` that will match unrelated findings.
- `source_file`: path to the generated `conclusion.md`

**Example**:
```
memory_ingest({
  title: "[discuss]: use Rust over TypeScript for knowledge server — compiler guardrails outweigh ecosystem convenience",
  content: "Decided Rust for the knowledge server. Rationale: agent-written code benefits from strict compiler checks; single binary simplifies deployment; sub-5ms startup for MCP stdio; fastembed-rs provides local embedding without Node.js overhead.",
  source_file: "docs/discussions/003-tech-stack/conclusion.md",
  source_type: "conclusion",
  knowledge_type: "decisional",
  entities: "rust,tech-stack,mcp,fastembed"
})
```

### 9. Doodlestein — Post-Conclusion Review

**Triggered when**: Conclusion document is written. Doodlestein reviews the **written conclusion**, not the discussion in progress. No round extensions from Doodlestein findings.

Per `ae:agent-teams` Doodlestein Protocol. Three fresh agents, each answering ONE focused question against the conclusion document.

```
Agent(subagent_type: "doodlestein-strategic", name: "doodlestein-strategic",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<path to conclusion.md> — single smartest improvement?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-adversarial", name: "doodlestein-adversarial",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<path to conclusion.md> — where does this first fail in real use?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-regret", name: "doodlestein-regret",
      team_name: "<existing team>", run_in_background: true,
      prompt: "<path to conclusion.md> — which decision most likely reversed in 6mo?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")
```

**TL processes findings**:

1. **Valid finding requiring response → kick off new round**. The team discusses the Doodlestein challenge directly. After the round, TL updates the conclusion to reflect the outcome. Then Doodlestein may run again on the revised conclusion (bounded by whether new Doodlestein agents produce new findings — identical findings mean convergence, not loop).
2. **Refuted finding** → record the exchange in the conclusion's Doodlestein Review section. No round.
3. **Out-of-scope finding** → record as a new backlog item in `output.backlog/unscheduled/`. No round.

**The key difference from pre-conclusion Doodlestein** (044 failure mode): Doodlestein audits **the actual written conclusion**, not an anticipated conclusion. If a new round fires, it's because a real finding challenges a written decision — not because of anticipatory churn. Team reviews a concrete artifact, not a moving target.

### 10. Team Shutdown & Next Steps

**Shutdown the team ONLY after Conclusion is written AND Doodlestein (Step 9) is complete.**

- All converged, no spawned → "Ready for `/ae:plan`"
- Has spawned discussions → "Resolve sub-discussions first, then `/ae:plan`"
- **Knowledge capture summary** — report what was ingested and any conflicts:
  - `Knowledge capture: [N] items ingested, no conflicts`
  - Or: `Knowledge capture: [N] items ingested, conflicts detected with: [titles]`

## Principles

- **Discussion Mode**: TL = moderator, all agents = equal participants. No forced proposer/opposition. Positions evolve based on evidence. Per `ae:agent-teams` Discussion Mode.
- **Team explores, TL synthesizes**: The value of ae:discuss is multi-agent collaborative exploration with code evidence. If the team didn't explore it, don't present it to the user.
- **Consensus verification**: Topics with decisions get stress-tested via temporary Debate Mode (forced FOR/AGAINST) before being marked converged. Discussion finds the direction, consensus confirms it.
- **One team, one lifecycle**: Spawn once, add agents as needed, never remove. Shutdown only after Doodlestein post-conclusion review completes.
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
<discussion-dir>/
  framing.md                 # problem statement, round_0 verdict (Step 1/1.5)
  index.md                   # minimal scaffolding
  topic-NN-slug/
    summary.md               # current state — agent reads ONLY this each round
  round-01/                  # per-round directory
    <agent-name>.md          # each agent's own file (self-written, TL does not edit)
    synthesis.md             # TL index/orientation + 4 mandatory fields (Pruned / Of-framing disposition / Verification artifact / Frame-challenge self-check)
  round-02/
    <agent-name>.md
    synthesis.md
  conclusion.md              # Step 8
  round-doodlestein/         # Step 9 post-conclusion review
    strategic.md
    adversarial.md
    regret.md
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
