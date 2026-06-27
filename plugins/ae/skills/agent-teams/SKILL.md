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

### Required `Agent()` tool fields (every spawn)

Every `Agent(...)` spawn MUST pass the Agent tool's required parameters — **including `description`** (a 3-5 word task summary). The per-skill spawn *templates* below and in the spawning SKILL.md files elide it for brevity, but **omitting `description` at spawn time is an `InputValidationError` that kills the agent before it starts** (observed in a Games-project dogfood — a 4-agent review batch failed on first send). Canonical shape (`description:` is a tool-level field, distinct from — and in addition to — the cast block that lives *inside* `prompt:`):

```
Agent(description: "<3-5 word task>", subagent_type: "<type>", name: "<name>",
      run_in_background: true, prompt: "<cast block at position 2 + context>")
```

### Cast Block Syntax

Before any `Agent(...)` spawn within a spawn batch, TL emits a structured **cast block** describing each agent's role + angle + rationale. The cast block is **dual-write**: appears in session stdout (user-visible) AND embedded in the spawn prompt's `prompt:` field (agent-receivable).

#### Canonical 4-field structure (MANDATORY)

All 4 fields — `Agent` / `Role` / `Angle` / `Why` — are **mandatory**. The `Agent` field appears in the header line `📋 Cast: <agent-name>`; the other 3 fields appear as indented lines below. Omitting any field fails AC1/AC5 mechanical verification.

**Per-spawn form** (canonical — used in all 13 spawning SKILL.md files, one cast block per `Agent()` call):

```
📋 Cast: <agent-name>
  Role: <one-line role assignment, e.g., "cross-family-reviewer (OpenAI angle)">
  Angle: <one-line focus, e.g., "prompt-engineering quality">
  Why: <one-line rationale, e.g., "Swarm/Assistants precedent applies">
```

**Multi-agent batch form** (optional summary header — TL may emit this to stdout before batch spawning):

```
📋 Cast — <team-name>
  - <agent-name-1>: <role-1> | <angle-1>
  - <agent-name-2>: <role-2> | <angle-2>
  ...
```

The per-spawn form is the embedded form (one cast block per `Agent()` prompt: field). The batch form is stdout-only summary.

#### Cost target (not hard cap)

≤ 200-300 tokens per cast block typical. ≤ 8 lines per agent **target** — exceed if clarity demands (OpenAI "give model room to think" principle); line count is target, not hard limit. Reviewers should flag cast blocks exceeding 12 lines as a signal that scope may be too broad for a single spawn.

#### Emit timing + Spawn prompt position

Cast block timing relative to existing Selection Trace + teammate spawning:

```
1. Layer 1 + Layer 2 selection trace (existing — Selection Trace Emission below)
2. 📋 Cast block emit (stdout) — NEW per F-019
3. Agent() calls — each with cast block embedded in prompt: field at position 2 (below)
```

When a spawn prompt has a PRIMARY CONTEXT BUNDLE, the cast block MUST appear at **position 2** of the prompt:

```
Agent(prompt: """
  <PRIMARY CONTEXT BUNDLE — position 1: files / discussion context / verbatim>

  📋 Cast: <agent-name>
    Role: <role>
    Angle: <angle>
    Why: <why> ← position 2

  <Task-specific instructions: domain, scope, checks> ← position 3
""")
```

When no PRIMARY CONTEXT BUNDLE is present (simpler skills with no per-invocation context bundle), cast block is at position 1 (first content of prompt body).

#### Dynamic / ad-hoc spawn note

- For `<per agent-selection>` placeholder spawns, the cast block template uses `<runtime-selected>` placeholder for `Agent:` field; TL fills at execution time
- For `/ae:team` ad-hoc spawns (TL chooses agents per task context, not from SKILL.md template), TL computes the full cast block at spawn-decision time per the skill prompt rules in `team/SKILL.md`

#### Mechanical verification

- `grep -c "📋 Cast:" <skill-file>` returns ≥ total `Agent()` spawn site count for that file (each spawn has a cast block whose header is `📋 Cast: <agent-name>`)
- `grep -cE "^\s*(Role|Angle|Why):" <skill-file>` returns ≥ 3 × cast count for that file (each cast block has 3 indented field lines; Agent identifier is in header `📋 Cast:` line)
- Cross-skill consistency: cast block `Role:` syntax follows uniform pattern across the 13 spawn-using SKILL.md files. **Two legitimate forms**: (a) short modal — `Role: opposition (review mode)` for analyze/review/think; (b) descriptive — `Role: opposition (critic in for/against debate, AGAINST position)` for consensus where stance is integral to the role. Future readers running cross-skill grep should accept both forms; the constraint is "parenthetical context after role noun-phrase," not literal `(<mode> mode)` text.

#### Rationale (positive pattern for Anti-Pattern "Routing lateral")

The "Routing lateral" anti-pattern at the end of this file forbids agent `.md` files from containing conditional routing logic ("in /ae:review send to X, in /ae:plan send to Y"). The positive pattern is: agents stay generic; routing/role is delivered via cast block in spawn prompt at spawn time. F-019 formalizes this positive pattern; `challenger.md` is the migration reference example (mode-conditional behavior delivered via cast block `Role:` field rather than agent-internal mode sections).

### Selection Trace Emission

Before spawning teammates, TL emits a structured selection trace per `ae:agent-selection` Layer 1 + Layer 2 trace format (SKILL.md `## Layer 1 trace format` and `## Layer 2 trace format` sections). Default-ON for all modes (Debate / Discussion / Investigation). No flag required.

Two surfaces, both default-emit:

1. **Console stdout** — Layer 1 events (governance firings, filter outcomes) + Layer 2 events (per role slot: `considered:` / `selected:` / `rationale:` / `library-fallback:`) printed line-by-line before spawning teammates. Line format per `ae:agent-selection` SKILL.md.
2. **Persisted output `## Agent Selection Trace` section** — when the skill writes a final report (conclusion.md, review.md, analysis.md, etc.), reproduce the trace lines verbatim under this section heading. Skills writing other persisted artifacts (e.g., `ae:team` writes to `output.analyses/`) embed the trace there.

Mechanical verification (used by `/ae:test-plugin` and any automated audit):
- `grep -E "^\[layer1\] " <stdout-or-output>` returns ≥ 1 line per team spawn
- `grep -E "^\[layer2\] (considered|selected|rationale|library-fallback):" <stdout-or-output>` returns ≥ 4 lines per role slot
- `grep -E "^\[cast\] " <stdout-or-output>` returns ≥ 1 line per `Agent()` spawn in the batch (NEW per F-019 — see Cast Block Syntax above)
- Skills writing reports: `grep -F "## Agent Selection Trace" <report>` returns ≥ 1 line

**[cast] line format**: `[cast] <agent> — role=<role>, angle=<angle>, why=<one-line>` — one line per Agent() spawn, complementary to the `[layer2] selected:` line (selection picks the agent; cast emits the role/angle/why for the chosen agent).

`--agent-debug` flag (per `ae:setup/agent-governance-format.md:177`) remains documented but is now a no-op signal: trace fires by default. Future `--quiet` flag MAY suppress emission for batch automation; not in scope here.

Rationale: F-003 closure review (2026-05-05) found that "emit-on-request" semantics (the v0.9.3 ship state) made the Layer 2 trace invisible by default. BL-058 closes the gap; observability is now the default behavior, not a hidden flag-gated feature.

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

Four fresh agents that join an existing team LATE, after initial rounds converge. They bring fresh perspective because they were NOT part of prior rounds — no sunk-cost bias, no emotional investment in prior positions. Each answers ONE focused question.

**When to trigger**: After main rounds converge, before final conclusion.
- **Debate Mode**: always triggered.
- **Discussion Mode**: always triggered (discussions produce decisions that need fresh-eyes validation).
- **Investigation Mode**: TL discretion — trigger when investigation produced decisions or recommendations. Skip for pure observational findings (e.g., trace output, factual analysis with no design choices).

**Per-skill agent-count asymmetry** (F-045): the canonical roster is four agents, spawned in full by `/ae:discuss` at its post-conclusion Doodlestein step. `/ae:plan` deliberately spawns only **three** (strategic / adversarial / regret) at its plan-review-stage Doodlestein step — `scope-reducer`'s question framing ("what should be cut from this conclusion?") is post-conclusion-specific and does not apply to plan-step decomposition review. This is an intentional subset, not an inconsistency: `/ae:discuss` = 4, `/ae:plan` = 3.

**The four Doodlestein agents** (agent definitions in `plugins/ae/agents/workflow/`):

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

#### doodlestein-scope-reducer
> **Spawned by `/ae:discuss` only** (post-conclusion). `/ae:plan`'s plan-review Doodlestein step spawns the other three — see the per-skill asymmetry note above. Future skills adding a Doodlestein step: this is the discuss-specific 4th agent, not a default.

> "Of everything the conclusion/synthesis adds beyond what the framed problem strictly needs, what could be deleted such that the original problem is still solved?"

- The SUBTRACT-shaped counterpart to the other three (strategic = accretive / adversarial = omissions / regret = reversal hedges). All three of those are ADD-shaped by question framing; scope-reducer is the only Doodlestein that asks "what should be cut?"
- Output is per-mechanism `Delete | Defer | Retain` classification with verbatim AC-quote required for Retain (paraphrasing reclassifies to Defer)
- Also emits one final-line `Strictly_needed_count: <int>` denominator estimate for downstream over-specification-ratio measurement

**How Doodlestein works**:
1. TL prepares two inputs: (a) file paths to relevant source code/artifacts, (b) lean decisions summary (decisions + rationale ONLY — no debate transcript, no full argument chains). Doodlestein agents receive file paths FIRST to form independent impressions, then the decisions summary for comparison.
2. TL spawns all four Doodlestein agents INTO the existing team simultaneously
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
| **hard-block** | ae:discuss, ae:review, ae:consensus, ae:test-plugin | Refuse to execute — multi-agent IS the feature (test-plugin requires blind protocol isolation via spawned teammates + test-lead). Tell user to enable Agent Teams. |
| **auto-fallback** | ae:analyze, ae:plan, ae:plan-review, ae:think, ae:trace, ae:testgen, ae:team, ae:work | Print `[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled.` TL executes directly, no team spawn. Output is lower confidence. |
| **no-pre-check** | ae:code-review | Uses plain Agent() subagents, not an addressable team. No Agent Teams dependency. |

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
- **Round-per-team**: Re-spawning the whole roster each round. One implicit team, one lifecycle — don't re-spawn teammates per round.
- **Routing lateral**: Agent .md files containing conditional routing logic ("in /ae:review send to X, in /ae:plan send to Y"). Routing decisions belong in skill spawn prompts, not agent definitions.

---

## Skill step progress tracking

Multi-step skills proactively use the Claude Code Task APIs (`TaskCreate` / `TaskUpdate`) to surface execution progress in the persistent task panel above the prompt. This complements (does NOT replace) the durable per-step disk artifact (`step-summaries.md` written by `/ae:work` post-commit). Tasks live for the conversation; step-summaries live across sessions. Task lists interact with team lifecycles — see §H before choosing task-creation timing.

### A. Canonical phase IDs

Each modified SKILL.md hard-lists its own phase IDs. Phase IDs are one of these forms (NO subtitles, NO reordering, NO parenthetical suffixes — except where an explicit exception is documented):

- `Pre-check` — singular. ONE task for the whole pre-check section, even when there are multiple sub-checks (Check 1, Check 2, etc.). Sub-checks are sub-actions, not phases.
- `Step N — <title>` — integer step number + em-dash + human-readable title. Title source:
  - **Fixed-phase skills** (ae:plan, ae:analyze, ae:discuss, ae:test-plugin): the task lifecycle table in the corresponding SKILL.md is the **canonical source of truth** for the title text. The title is allowed to differ from the SKILL.md `## Step N:` / `## Phase N:` heading text — short panel-friendly titles are preferred (e.g., task title `Plan Review` vs heading `Agent Teams Plan Review`; task title `Test Generation` vs heading `Test Case Generation`; task title `Doodlestein Challenge` for heading `Doodlestein Challenge (optional)`). When the spec heading is already short and panel-friendly, match it verbatim.
  - **ae:work** (plan-dependent): runtime-extracted from the plan body's `### Step N: <title>` heading at batch-create time (Pre-check Check 2 already reads the plan body to enumerate steps; pull the title from the same parse). **Normalization order** (apply in this exact order):
    1. **Strip trailing commit marker**: remove `✅ <hash>` (the post-commit checkmark + short SHA pattern; regex `\s*✅\s*[a-f0-9]+\s*$`) if present.
    2. **Strip trailing AC reference**: remove `(AC1)`, `(AC2, AC3)`, etc. (regex `\s*\(AC[0-9, ]+\)\s*$`) if present. Apply only at end-of-string — DO NOT strip mid-title parenthetical content.
    3. **Trim whitespace** at both ends.
    4. **Empty-title fallback**: if the resulting title is empty or whitespace-only (e.g., heading was `### Step 3:` with no title text), emit subject as `<skill>: Step N` with NO em-dash and NO title suffix (the no-title form is a legitimate fallback, not an error).
    5. **Truncate** to 42 chars (right-side cut). After cut, trim trailing whitespace + trailing `-`/`—` if the cut landed on one. The full subject `<skill>: Step N — <title>` stays under ~60 chars.

    Edge case — heading already contains an em-dash in the title (e.g., `### Step 5: Migration — final cutover (AC2)`): the title after stripping AC ref is `Migration — final cutover`. Do NOT split on the inner em-dash; the title is the whole post-`Step 5:` substring. Subject becomes `ae:work: Step 5 — Migration — final cutover` — readable and correct.
- `Phase N — <title>` — same shape, used by ae:test-plugin.
- `TDD Cycle` — ae:work specific, for the per-step TDD inner loop (when used as a tracked phase rather than as a sub-action).
- Review track names verbatim (ae:review only): `Security review`, `Performance review`, `Architecture review`, `Cross-family challenge + synthesis` — already self-describing, no title suffix needed.

**When is the title suffix required vs optional?** A title suffix is **required** for any phase ID that is a generic numeric or sequence identifier — `Step N`, `Phase N`, mode placeholders. A title suffix is **omitted** only when the phase ID itself is already a self-describing label: `Pre-check`, `Research`, `Synthesize`, ae:review's 4 track names. Future skill authors: do NOT introduce opaque numeric IDs without titles. If a new skill's phase is genuinely a numeric step, it MUST have a title; if it's a self-describing concept, prefer naming it directly without a number.

**Subject string format**: `"<skill-name>: <phase-id> — <title>"` — colon + space + phase-id + em-dash + title. Examples:

| ✅ Use | ❌ Don't use |
|---|---|
| `ae:work: Pre-check` (no title — Pre-check is self-describing) | `ae:work: Pre-check — checks` (redundant) |
| `ae:work: Step 1 — ae:plan writes to feature dir` | `ae:work: Step 1` (opaque) |
| `ae:plan: Step 3 — Plan Review` | `ae:plan: Step 3` (opaque) |
| `ae:review: Security review` (track names self-describe) | `ae:review: Security review — security` (redundant) |
| `ae:test-plugin: Phase 1 — Test Generation` | `ae:test-plugin: Phase 1` (opaque) |

The em-dash separator (`—`, U+2014) — not hyphen, not double-hyphen — gives a visually clean break between phase-id and title in panel rendering. Use a literal em-dash character.

Each modified SKILL.md MUST inline its full canonical phase list at the top of its execution flow section. The agent-teams reference (this section) is teaching documentation, NOT a runtime parser — agents executing a skill consult that skill's inline list, not this table.

### B. Per-skill task list (canonical)

| Skill | Tasks created | Total |
|---|---|---|
| `ae:work` | `Pre-check`, `Step N — <step title>` (one per plan step; title runtime-extracted from `### Step N: <title>` heading) | 1 + N |
| `ae:plan` | `Pre-check`, `Step 1 — Research`, `Step 2 — Write Plan`, `Step 3 — Plan Review`, `Step 4 — Doodlestein Challenge`, `Step 5 — Confirm` | 6 |
| `ae:review` | `Pre-check`, then the 4 review tracks (`Security review`, `Performance review`, `Architecture review`, `Cross-family challenge + synthesis`) | 5 |
| `ae:analyze` | `Pre-check`, `Mode A — Promote BL` or `Mode B — Free-text Feature` (mutually exclusive), `Research`, `Synthesize` | 4 |
| `ae:discuss` | `Pre-check`, `Step 1 — Setup`, `Step 1.5 — Round 0 Framing`, `Step 2 — Spawn Team`, `Step 3 — Discussion Rounds`, `Step 7 — Sweep Deferred`, `Step 8 — Generate Conclusion`, `Step 9 — Doodlestein` | 8 |
| `ae:test-plugin` | `Pre-check`, `Phase 1 — Test Generation`, `Phase 2 — Execution`, `Phase 3 — Report` | 4 |

Sub-actions deliberately excluded (analysis flagged them as noise): TDD sub-cycles (write/red/implement/green/refactor), individual Pre-commit Checks A-G in ae:work, Synthesis / Fixup / Outcome Statistics / Output / Knowledge Capture / Completion Invariant in ae:review, Steps 4-6 (Consensus / TL Scores / Present) and Step 10 (Shutdown) in ae:discuss.

The per-skill task list is **static and design-time** — agents do NOT estimate phase duration at runtime to decide which to track. The static list is the contract.

### C. Lifecycle

1. **At skill start**: batch-create all known tasks via one `TaskCreate` per row in the per-skill list above. For ae:work specifically, the `Step N` rows are plan-dependent — defer the per-step `TaskCreate` calls until after Pre-check Check 2 reads the plan body, then create one task per `### Step N` heading found. (Timing: "at skill start" is the default — with one implicit team, tasks stay accessible throughout the run; see §H.)

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
- This differs from agent-claimed tasks (where `owner` is the assigned agent name from an Agent() spawn).
- Fallback if a future Claude Code update enforces `owner` on `TaskUpdate`: change to `owner: "skill:<skill-name>"` (plain identifier — no UUID, no session ID).

### F. Concurrent invocation note

Two concurrent skill runs producing the same subject (e.g., `"ae:work: Pre-check"` × 2 from parallel sessions) are visible separately in the panel because the harness assigns each `TaskCreate` a unique task ID. Task IDs disambiguate at the harness level; subjects do not. The panel may show duplicate-titled tasks under heavy concurrent use; this is a readability tradeoff, not a correctness bug. If panel readability degrades materially under sustained concurrency (3+ skills running simultaneously), file a follow-on BL — do not pre-engineer a session-uuid prefix scheme.

### G. Interaction with `step-summaries.md`

Tasks and step-summaries serve different time horizons:

- **Tasks**: ephemeral, conversation-scoped, visible during execution.
- **`step-summaries.md`**: durable, written post-commit by ae:work, readable across sessions, consumed by the Context Overlap Heuristic in subsequent ae:work runs.

They are complementary, not redundant. A skill execution that completes successfully will produce both (tasks visible during the run; step-summaries persisted to `<output.milestones>/<plan-id>/step-summaries.md` after each commit).

### H. Team-context interaction (tasks vs teams)

With ONE implicit team per session, there is a single task list for the whole session — there is no team-switching, so step tasks created at any point stay accessible for the entire run. The earlier orphan-window problem (`Task not found` while a team was active) no longer applies under the implicit-team model.

- **Rule 1 — batch-create at skill start**: create step tasks at skill start (the default in §C); they remain accessible throughout because spawning teammates does not switch the active task list.
- **Precedence**: this canonical rule wins; existing per-skill tables update opportunistically the next time each skill is modified — no big-bang rewrite.

### Auto-compact panel freeze (known limit)

The Claude Code task panel can freeze rendering during auto-compact for long-running skills (10+ phase transitions in one run). The underlying state is consistent — only the rendering is frozen. If a skill appears stuck in the panel but the conversation is progressing, trust the conversation; the panel will catch up after the next refresh.

## Shutdown handshake (canonical)

Per Plan 055 T2 schema discipline: this is the single canonical specification of the SendMessage shutdown handshake protocol. All teammate agents reference this section instead of inlining the JSON schema (CI enforced by `plugins/ae/scripts/check-shutdown-canonical.sh`).

When TL sends `shutdown_request` to a teammate, the teammate replies `shutdown_response`:

**Request (TL → teammate)**:
```
{"type": "shutdown_request", "reason": "<short string>"}
```

**Response (teammate → TL)**:
```
{"type": "shutdown_response", "request_id": "<echo from request id>", "approve": true | false, "reason": "<optional>"}
```

**Behavior**:
- The response MUST be sent as a JSON **object** in SendMessage's `message` parameter — NOT as a text string. Stringified JSON (even with correct request_id and all fields present) is not parsed by the harness and does NOT terminate the teammate (observed twice: F-037 gemini-proxy prose ×3, F-041 codex-proxy-2 stringified-JSON ×2).
  - Correct: `message: {"type": "shutdown_response", "request_id": "…", "approve": true}` (object) · Wrong: `message: "{\"type\": \"shutdown_response\", …}"` (string — not parsed)
- Teammate MUST reply within 30s of request OR be force-abandoned by TL
- `approve: false` blocks shutdown (rare — teammate has urgent in-flight work)
- There is no explicit team teardown call — teammates and team config are cleaned up automatically at session end. The shutdown handshake remains the way TL releases a teammate during a session.
- Force-abandoned teammates have verdict files written before TL moves on (audit trail)
- Do NOT send custom JSON variants — use the exact shape above

**Why centralized**: 15 agent .md files previously embedded this schema inline (copy-paste drift accumulated). Centralizing to this canonical section means schema evolution (e.g., adding fields) only edits this 1 location; agent references inherit automatically.

**Whitelist exempt agents** (not required to reference this section):
- `agents/engineering/minimal-change-engineer.md` — current contract is "stay in team until force-abandon", no shutdown_response participation
- `agents/workflow/test-lead.md` — same; uses Class A/B resurrection lifecycle instead

Future agent additions either reference this section OR get explicitly added to the whitelist in `scripts/check-shutdown-canonical.sh` (audit trail requirement).
