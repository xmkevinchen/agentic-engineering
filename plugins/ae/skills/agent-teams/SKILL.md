---
name: ae:agent-teams
description: "Reference: Agent Teams protocol reference — base rules, debate mode, investigation mode. Used by all skills that spawn Agent Teams."
user-invocable: true
---

**Protocol Map** — if detail for any section is missing below, read this SKILL.md file directly before proceeding.
Sections: Base Rules → Team Communication → Debate Mode → Discussion Mode → Investigation Mode → Doodlestein Protocol → Shutdown Protocol

# Agent Teams Protocol Reference

All skills that spawn Agent Teams reference this protocol. `ae:agent-selection` defines WHO to pick. This skill defines HOW they operate.

Two-tier structure:
- **Base Protocol** — applies to ALL Agent Teams regardless of mode
- **Mode Protocol** — skills choose one of: Debate Mode, Discussion Mode, or Investigation Mode

---

## Base Protocol

These rules apply to every Agent Team.

### TL is Moderator

TL (Session TL) is the moderator/judge for every team. NEVER an agent.

TL responsibilities:
- Drives rounds, routes messages between agents
- Judges evidence, synthesizes conclusions, makes final calls
- Decides when to escalate to user (per CLAUDE.md TL Autonomy Boundary)

### Team Lifecycle

```
Spawn → Rounds → [Add agents as needed] → Conclusion → Shutdown
```

- **Spawn once** per task/discussion. One team lives for the entire lifecycle.
- **Only add agents, never remove for disagreement.** Strong disagreement is signal, not noise.
- **Non-responsive agents**: If an agent has not responded within 120s after a round prompt, TL marks it as unresponsive and proceeds without it. This is operational, not removal for dissent. (Extends Proxy Timeout Protocol from `ae:agent-selection` to all agents.)
- **Shutdown only after conclusion is written.** If the skill has a Doodlestein step, team close MUST be after Doodlestein completes — original team members must be alive to respond to challenges.

### Communication Rules

- **Round 1 isolation**: Agents communicate only via SendMessage to team-lead. Do not write intermediate findings to shared discussion directories. Do not read files other agents may have written during this round.
- **Post Round 1**: Agents may SendMessage to team-lead or to each other directly. Agent-to-agent communication is a design intent — agents should interact like real collaborators.

### Lateral Communication

Agent-to-agent direct messaging is permitted and encouraged. TL does not gatekeep agent communication — TL orchestrates it (see TL Orchestration below).

Examples of valid lateral messaging:
- dev notifies qa "step done, ready for review"
- qa sends findings to dev for fixes
- challenger sends probe to security-reviewer for domain assessment
- architect sends step decomposition to dependency-analyst for validation

The only restriction: Round 1 isolation (agents research independently before any cross-talk).

### TL Orchestration

TL is an active orchestrator for **declared dependency waits** — cases where an agent's definition or spawn prompt says "wait for X." TL ensures these agents receive the information they're waiting for.

**Dependency forwarding**: When agent A declares "wait for B" (in agent definition or spawn prompt), TL must:
1. Know this dependency exists (skill SKILL.md documents the dependency graph)
2. When B's findings arrive at TL, forward them to A
3. If A sends a message only to TL that B needs, forward it to B

TL forwards based on declared dependency waits only — not a general message router. Agents who communicate directly don't need TL in the loop.

**When to forward vs when not to**:
- Forward: agent findings that another agent is explicitly waiting for
- Forward: messages that contain information relevant to an agent's declared dependencies
- Do not forward: routine status updates that only TL needs
- Do not forward: messages between agents who are already communicating directly

### Evidence Requirement

All agent findings must include evidence: file:line references, concrete data, specific examples. Opinions without evidence are dismissed. This applies to both Debate and Investigation modes.

### Dynamic Composition

- Agent roles determined by task content via `ae:agent-selection` Selection Table.
- **Multiple instances of same backend allowed** (e.g., codex-as-researcher + codex-as-architect). Require differentiated prompts with genuinely different review angles, not just different labels. Note in conclusion when agents share a backend — correlated outputs should not count as independent validation.
- Show selected team to user before launching (per `ae:agent-selection` Rule 5).

### Adding Agents Mid-Discussion

1. TL identifies gap (e.g., "we need a security perspective")
2. TL spawns additional agent into existing team
3. New agent gets caught up via topic brief + current state
4. Never remove existing agents (except non-responsive, see lifecycle)

### Doodlestein Protocol

Three fresh agents that join an existing team LATE, after initial rounds converge. They bring fresh perspective because they were NOT part of prior rounds — no sunk-cost bias, no emotional investment in prior positions. Each answers ONE focused question.

**When to trigger**: After main rounds converge, before final conclusion.
- **Debate Mode**: always triggered.
- **Discussion Mode**: always triggered (discussions produce decisions that need fresh-eyes validation).
- **Investigation Mode**: TL discretion — trigger when investigation produced decisions or recommendations. Skip for pure observational findings (e.g., trace output, factual analysis with no design choices).

**The three Doodlestein agents** (agent definitions in `plugins/ae/agents/workflow/`):

#### doodlestein-strategic
> "What's the single smartest and most radically innovative improvement you could make to this at this point?"

- ONE recommendation only, not a list
- Grounded in codebase — reference real code, patterns, capabilities
- Stay within scope — improvements to what was built, NOT new features or scope expansion

#### doodlestein-adversarial
> "Check over everything again with fresh eyes looking for any blunders, mistakes, errors, oversights, omissions, problems, misconceptions, bugs, etc."

- Look for things the team MISSED, not things they already found
- Be specific: file:line references, concrete issues, not vague concerns
- Focus on blind spots — assumptions nobody questioned, constraints nobody checked, edge cases nobody considered
- 3-7 findings max, ranked by severity

#### doodlestein-regret
> "Which decision made here is most likely to be reversed within 6 months?"

- Must cite specific code/architecture evidence for WHY (not "feels wrong")
- Must state concrete trigger condition (e.g., "when user count exceeds X")
- Must suggest a low-cost hedge that can be done NOW without reversing the decision

**How Doodlestein works**:
1. TL prepares two inputs: (a) file paths to relevant source code/artifacts, (b) lean decisions summary (decisions + rationale ONLY — no debate transcript, no full argument chains). Doodlestein agents receive file paths FIRST to form independent impressions, then the decisions summary for comparison.
2. TL spawns all three Doodlestein agents INTO the existing team simultaneously
3. Each Doodlestein agent SendMessage findings to team-lead (not directly to team — TL moderates)
4. TL routes challenges to ALL team members simultaneously (not Host-first — proposer's motivated defense should not be the primary input)
5. All agents must respond — no hiding
6. TL judges which challenges have merit. TL does not give proposer's response higher weight than opposition's independent assessment
7. Valid challenge → TL opens new rounds (all agents participate, including Doodlestein)
8. Refuted → TL records the exchange

---

## Debate Mode

For skills where a specific proposal/artifact needs adversarial validation: ae:consensus, ae:plan, ae:plan-review, ae:review.

### Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Moderator** | TL | Per Base Protocol |
| **Proposer** | One agent | Proposes positions, defends with evidence. Has opinions. Is NOT neutral. |
| **Opposition** | Other agents | Challenge proposer based on their genuine assessment. Organic positions. |
| **Devil's Advocate** | One agent (always present) | MUST oppose the proposer regardless of personal assessment. Forced adversarial stance. |

**Critical rule**: Proposer must NEVER moderate, synthesize, or control the narrative. That is TL's job.

**Devil's Advocate purpose**: Guarantees adversarial pressure every round, even when opposition agents agree with the proposer. If the devil's advocate is thoroughly rebutted with evidence, that itself is the strongest validation signal — the proposal survived its hardest challenge. A devil's advocate that is never rebutted indicates the team isn't engaging seriously.

**Consensus escalation**: When a topic remains deeply contested after normal rounds, TL can temporarily reassign agents to forced stances (advocate FOR / critic AGAINST) for that specific topic — full `ae:consensus` structured debate within the existing team. This is heavier than normal debate and used only when organic positions fail to resolve the disagreement.

**Proposer selection** (per skill):
- ae:plan / ae:plan-review → Architect (defends plan)
- ae:review → code-defender perspective
- ae:consensus → Advocate
- Skill SKILL.md specifies which agent is proposer

### Round Protocol (minimum 2 rounds)

#### Round 1 — Independent Research (no cross-talk)
- TL sends topic brief to all agents
- Each agent researches independently (reads code, finds evidence, forms position)
- Each agent reports findings to team-lead only
- TL does NOT share findings between agents yet

#### Round 2 — Debate
- TL compiles all Round 1 positions, highlights disagreements and gaps
- TL sends compiled summary to all agents: "Here are all positions. Debate."
- Proposer defends, opposition attacks
- All agents use **Structured Output** (see below)
- TL routes messages, tracks arguments

#### Round 3+ — Convergence
- TL identifies topics where evidence clearly supports one side
- Topics still contested → TL runs **Cross-Examination** (see below)
- Sub-questions resolved in-team — do NOT bubble up to user
- Continue until all topics have clear direction or confirmed genuine dilemma

**Convergence criteria**: A topic has "clear direction" when one side's claims are evidence-backed and the other side has conceded or failed to provide counter-evidence after cross-examination.

**Early-exit gate**: After Round 2, if ALL agents explicitly concede all contested claims with evidence and no cross-examination challenges remain, TL may skip further rounds. This is TL's judgment call — the goal is preventing premature convergence, not mandating theater.

### Structured Output

All debate agents MUST use this format when arguing:

```
## Position: FOR / AGAINST / INDEPENDENT

### Claims
1. [Claim] — Evidence: [file:line or concrete data]
2. [Claim] — Evidence: [file:line or concrete data]

### Conceded Points
- [Points where the opposing side is right — be honest]

### Responses to Opponent Claims
- [Opponent claim] → [agree / partially agree / disagree + rationale]
```

**Rules:**
- Every claim must have evidence. Opinions without evidence are dismissed.
- Conceded Points are mandatory. An agent that concedes nothing is not engaging honestly.
- Concede only to stronger evidence, not social pressure.

### Cross-Examination

When a topic remains contested after Round 2:

1. TL extracts top 2-3 claims from each side
2. TL sends to proposer: "Respond to opposition claims: [list]. For EACH: agree / partially agree / disagree + rationale."
3. TL sends to opposition: "Respond to proposer claims: [list]. For EACH: agree / partially agree / disagree + rationale."
4. TL evaluates responses:
   - Has either side raised arguments the other hasn't addressed?
   - Are claims backed by concrete evidence?
   - If still unresolved → another round of cross-examination (max 3 total)
   - If resolved → mark converged
   - **After max 3 with no convergence** → TL decides by evidence preponderance (side with stronger file:line evidence wins), or marks as genuine dilemma and escalates per CLAUDE.md TL Autonomy Boundary

---

## Discussion Mode

For skills where the goal is collaborative exploration of open questions — no pre-formed proposal to defend: ae:discuss.

### Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Moderator** | TL | Per Base Protocol. Additionally: highlights disagreements between agents, surfaces under-explored angles, prevents premature convergence. |
| **Participants** | All agents | Equal participants. Research, form positions, evolve positions freely based on new evidence. No forced stances. |

No fixed proposer/opposition. Agents bring different expertise and perspectives but are not locked into adversarial roles. Changing your position based on another agent's evidence is expected and valuable — not a "concession."

### Groupthink Prevention

Without forced adversarial roles, groupthink prevention relies on structural mechanisms:

1. **Round 1 isolation** (Base Protocol) — agents research independently, no cross-talk
2. **TL highlights disagreements** — in Round 2, TL explicitly surfaces where agents differ and demands they address each other's evidence
3. **Unanimous Agreement Gate (UAG)** — structural, mandatory, not TL discretion. See below.

### Unanimous Agreement Gate (UAG)

"Agreement is a bug" — AI agents trained on similar data converge to the same "most likely answer," which is statistical repetition, not genuine consensus.

**When triggered**: Automatically, whenever all agents reach the same direction on a topic AND no agent has raised boundary conditions or counterexamples.

**How it works**:
1. TL sends a structured falsification question to ALL agents:
   > "List at least one: (a) what condition in the codebase would make this direction wrong? (b) what scenario would make this decision's cost unacceptable?"
2. Agents MUST answer with specific file:line references or concrete scenarios. "I can't think of any" is not acceptable — the agent must attempt the search.
3. **Answers reveal real concerns** → continue discussion rounds with the new evidence
4. **Answers confirm no falsifiable condition found** → genuine convergence. Record: "UAG passed: no falsifiable condition found by any agent." Proceed.

**Key principle**: Finding no counterexample after structured search IS the strongest convergence signal. The value is in the search, not in forcing artificial disagreement.

### Escalation to Debate Mode

Discussion Mode can escalate specific topics to Debate Mode (forced FOR/AGAINST) within the same team when needed. This is a tool available to both Discussion Mode and the calling skill. See ae:discuss for consensus verification as a quality gate.

### Round Protocol (minimum 2 rounds)

#### Round 1 — Independent Research (no cross-talk)
- TL sends topic brief to all agents
- Each agent researches independently, forms initial position with evidence
- Reports findings to team-lead only

#### Round 2 — Share & Explore
- TL compiles all Round 1 findings, highlights disagreements and gaps
- TL sends compiled summary to all agents
- Agents respond to each other's findings — agree, build on, or challenge with evidence
- Positions may evolve — this is expected, not failure
- TL identifies which topics are converging and which have genuine disagreement

#### Round 3+ — Convergence
- TL pushes converging topics toward conclusion
- Disagreeing topics get more rounds or escalate to consensus (per-topic)
- Sub-questions resolved in-team

**Early-exit gate**: Same as Debate Mode — after Round 2, if all evidence points same direction with no unresolved disagreements, TL may conclude.

### Structured Output (lighter than Debate Mode)

Discussion participants use:

```
## Findings
1. [Finding/Position] — Evidence: [file:line or concrete data]
2. [Finding/Position] — Evidence: [file:line or concrete data]

## Agreements
- [Points where I agree with other agents' findings]

## Disagreements
- [Agent X's finding Y] → I disagree because [evidence]

## Open Questions
- [Things I couldn't determine, need more research]
```

Key difference from Debate Mode: no forced FOR/AGAINST position. Agents report what they found, not what side they're on.

---

## Investigation Mode

For skills where the goal is analysis/discovery, not adversarial decision-making: ae:think, ae:trace, ae:analyze, ae:testgen, ae:team.

### Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Moderator** | TL | Per Base Protocol |
| **Investigators** | All agents | Research independently, report findings with evidence |

No proposer/opposition distinction. Agents are collaborative investigators, not adversaries. TL synthesizes all findings.

### Round Protocol (no minimum)

#### Round 1 — Parallel Investigation
- TL sends task brief to all agents
- Each agent investigates independently (per Base Protocol communication rules)
- Each agent reports findings to team-lead with evidence (file:line)

#### Round 2 (optional) — Cross-Check
- TL compiles findings, identifies contradictions or gaps
- TL sends compiled findings to agents for cross-checking
- Agents validate or challenge each other's findings
- Not a debate — goal is accuracy, not winning

#### Synthesis
- TL synthesizes all agent findings into final output
- No agent synthesizes on behalf of TL

**Key difference from Debate**: No minimum rounds. If all agents agree and evidence is consistent, TL may synthesize after Round 1. Cross-check round only when TL identifies contradictions.

---

## Degradation

When Agent Teams is unavailable (env var not set or feature gate closed), skills degrade based on tier:

| Tier | Skills | Behavior |
|------|--------|----------|
| **hard-block** | ae:discuss, ae:review, ae:consensus, ae:test-plugin | Refuse to execute — multi-agent IS the feature (test-plugin requires blind protocol isolation via TeamCreate + test-lead). Tell user to enable Agent Teams. |
| **auto-fallback** | ae:analyze, ae:plan, ae:plan-review, ae:think, ae:trace, ae:testgen, ae:team, ae:work | Print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` TL executes directly, no team spawn. Output is lower confidence. |
| **no-pre-check** | ae:code-review | Uses plain Agent() subagents, not TeamCreate. No Agent Teams dependency. |

Each skill's pre-check implements its tier. Auto-fallback skills may have skill-specific fallback details (e.g., ae:plan stays draft, ae:work uses "Lead executes directly" path).

### Enhanced Detection (recommended for auto-fallback tier)

Beyond the env var check, auto-fallback skills can verify `run_in_background` parameter availability via `ToolSearch("select:Agent")`. If the Agent tool schema is returned without `run_in_background`, the feature is partially gated (e.g., CI/headless environments). Degrade per tier table. If ToolSearch returns no results (Agent already loaded as first-class tool) or fails — fail-open and proceed. Cache the result per skill invocation. See ae:work Check 3 for reference implementation.

---

## Anti-Patterns

- **Proposer as moderator**: Letting proposer collect, summarize, or route messages. TL does this.
- **Agent as synthesizer**: Any agent producing the "final report" instead of TL. TL synthesizes.
- **Premature convergence** (debate mode): Agreeing after 1 round without genuine debate. Minimum 2 rounds; early-exit only with full explicit concession.
- **Evidence-free claims**: "I think X is better" without file:line citations. Dismissed.
- **Concession-free debate**: Agent that never concedes anything is not engaging honestly.
- **Killing dissenters**: Removing an agent because they disagree. Strong opinions are assets.
- **Round-per-team**: Spawning a new team each round. One team, one lifecycle.
- **Routing lateral**: Agent .md files containing conditional routing logic ("in /ae:review send to X, in /ae:plan send to Y"). Routing decisions belong in skill spawn prompts, not agent definitions.

---

## Skill step progress tracking

Multi-step skills proactively use the Claude Code Task APIs (`TaskCreate` / `TaskUpdate`) to surface execution progress in the persistent task panel above the prompt. This complements (does NOT replace) the durable per-step disk artifact (`step-summaries.md` written by `/ae:work` post-commit). Tasks live for the conversation; step-summaries live across sessions.

### A. Canonical phase IDs

Each modified SKILL.md hard-lists its own phase IDs. Phase IDs are exactly one of these forms (NO subtitles, NO reordering, NO parenthetical suffixes):

- `Pre-check` — singular. ONE task for the whole pre-check section, even when there are multiple sub-checks (Check 1, Check 2, etc.). Sub-checks are sub-actions, not phases.
- `Step N` — integer step number only (e.g., `Step 3`). NOT `Step 3: Locate Current Step`, NOT `Step 3 (Pre-check)`.
- `Phase N` — for skills using Phase numbering (ae:test-plugin, ae:discuss).
- `TDD Cycle` — ae:work specific, for the per-step TDD inner loop (when used as a tracked phase rather than as a sub-action).
- Review track names verbatim (ae:review only): `Security review`, `Performance review`, `Architecture review`, `Cross-family challenge + synthesis`.

**Subject string format**: `"<skill-name>: <phase-id>"` — colon + space separator. Examples: `"ae:work: Pre-check"`, `"ae:work: Step 3"`, `"ae:review: Security review"`.

Each modified SKILL.md MUST inline its full canonical phase list at the top of its execution flow section. The agent-teams reference (this section) is teaching documentation, NOT a runtime parser — agents executing a skill consult that skill's inline list, not this table.

### B. Per-skill task list (canonical)

| Skill | Tasks created | Total |
|---|---|---|
| `ae:work` | `Pre-check`, `Step N` (one per plan step, plan-dependent dispatch) | 1 + N |
| `ae:plan` | `Pre-check`, `Step 1`, `Step 2`, `Step 3`, `Step 4`, `Step 5` | 6 |
| `ae:review` | `Pre-check`, then the 4 review tracks (`Security review`, `Performance review`, `Architecture review`, `Cross-family challenge + synthesis`) | 5 |
| `ae:analyze` | `Pre-check`, `Mode A` or `Mode B` (mutually exclusive), `Research`, `Synthesize` | 4 |
| `ae:discuss` | `Pre-check`, `Step 1 Setup`, `Step 1.5 Round 0`, `Step 2 Spawn`, `Step 3 Discussion`, `Step 7 Sweep`, `Step 8 Conclusion`, `Step 9 Doodlestein` | 8 |
| `ae:test-plugin` | `Pre-check`, `Phase 1`, `Phase 2`, `Phase 3` | 4 |

Sub-actions deliberately excluded (analysis flagged them as noise): TDD sub-cycles (write/red/implement/green/refactor), individual Pre-commit Checks A-G in ae:work, Synthesis / Fixup / Outcome Statistics / Output / Knowledge Capture / Completion Invariant in ae:review, Steps 4-6 (Consensus / TL Scores / Present) and Step 10 (Shutdown) in ae:discuss.

The per-skill task list is **static and design-time** — agents do NOT estimate phase duration at runtime to decide which to track. The static list is the contract.

### C. Lifecycle

1. **At skill start**: batch-create all known tasks via one `TaskCreate` per row in the per-skill list above. For ae:work specifically, the `Step N` rows are plan-dependent — defer the per-step `TaskCreate` calls until after Pre-check Check 2 reads the plan body, then create one task per `### Step N` heading found.

2. **Mid-plan resumes** (ae:work entering on step 3 of 5 because steps 1-2 are `[x]`): create tasks for ALL plan steps; immediately call `TaskUpdate(taskId, status: "completed")` for already-`[x]` steps; leave pending steps at default `pending` status. Panel reflects accurate state on resume.

3. **Phase begin**: immediately before the first tool call, file read/write, user-visible decision, or delegated agent spawn within the phase, call `TaskUpdate(taskId, status: "in_progress")`. The "begin" boundary is precise — not at conceptual phase entry, but at the first observable action.

4. **Phase complete**: when the phase satisfies its **completion criterion** (see section D), call `TaskUpdate(taskId, status: "completed")`.

### D. Per-phase completion criteria

| Phase | Completion criterion |
|---|---|
| `Pre-check` (any skill) | All numbered checks evaluated to pass; control reached the next phase |
| `Step N` (ae:work) | Pre-commit Check G (Fix & Re-review) returned clean AND `git commit` returned 0 |
| `Step N` (ae:plan) | Plan file written to disk AND frontmatter status set per the step's intent |
| Review tracks (ae:review) | Track agent's findings received via SendMessage at TL |
| `Mode A` / `Mode B` (ae:analyze) | Promote completed (Mode A) or feature dir + index.md created (Mode B) |
| `Research` / `Synthesize` (ae:analyze) | Agent Teams findings collected (Research) or analysis.md written (Synthesize) |
| Discussion phases (ae:discuss) | The phase's spec'd output state reached (per Step 1.5.5 boundary, Round 1 file written, etc.) |
| `Phase N` (ae:test-plugin) | Phase's spec'd terminal output produced (per Phase 1.3 / Phase 2 Class A or B / Phase 3 report) |

If a phase exits by **refusal**, **blocker**, **unhandled error**, or **user pause** before its completion criterion is satisfied, do NOT call `TaskUpdate(completed)`. The task stays at `in_progress` so the user sees exactly where execution stopped.

Only allowed status enum values: `pending | in_progress | completed | deleted`. Do NOT invent novel states like `completed_with_warning` or `failed`.

### E. Owner field for self-tracking

Tasks created by skills for self-tracking MUST omit the `owner` field entirely (do not pass it). Self-tracking tasks are not for claim by other agents.

- `owner=null` (omitted) means: the harness treats this as unassigned. The skill creating and completing the task does not claim ownership; ownership is intentionally absent for skill self-tracking tasks.
- This differs from agent-claimed tasks (where `owner` is the assigned agent name from a TeamCreate spawn).
- Fallback if a future Claude Code update enforces `owner` on `TaskUpdate`: change to `owner: "skill:<skill-name>"` (plain identifier — no UUID, no session ID).

### F. Concurrent invocation note

Two concurrent skill runs producing the same subject (e.g., `"ae:work: Pre-check"` × 2 from parallel sessions) are visible separately in the panel because the harness assigns each `TaskCreate` a unique task ID. Task IDs disambiguate at the harness level; subjects do not. The panel may show duplicate-titled tasks under heavy concurrent use; this is a readability tradeoff, not a correctness bug. If panel readability degrades materially under sustained concurrency (3+ skills running simultaneously), file a follow-on BL — do not pre-engineer a session-uuid prefix scheme.

### G. Interaction with `step-summaries.md`

Tasks and step-summaries serve different time horizons:

- **Tasks**: ephemeral, conversation-scoped, visible during execution.
- **`step-summaries.md`**: durable, written post-commit by ae:work, readable across sessions, consumed by the Context Overlap Heuristic in subsequent ae:work runs.

They are complementary, not redundant. A skill execution that completes successfully will produce both (tasks visible during the run; step-summaries persisted to `<output.milestones>/<plan-id>/step-summaries.md` after each commit).

### Auto-compact panel freeze (known limit)

The Claude Code task panel can freeze rendering during auto-compact for long-running skills (10+ phase transitions in one run). The underlying state is consistent — only the rendering is frozen. If a skill appears stuck in the panel but the conversation is progressing, trust the conversation; the panel will catch up after the next refresh.
