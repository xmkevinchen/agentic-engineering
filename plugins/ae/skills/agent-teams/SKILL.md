---
description: Agent Teams protocol reference — base rules, debate mode, investigation mode. Used by all skills that spawn Agent Teams.
---

# Agent Teams Protocol Reference

All skills that spawn Agent Teams reference this protocol. `ae:agent-selection` defines WHO to pick. This skill defines HOW they operate.

Two-tier structure:
- **Base Protocol** — applies to ALL Agent Teams regardless of mode
- **Mode Protocol** — skills choose Debate Mode or Investigation Mode

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
- **Shutdown only after conclusion is written.**

### Communication Rules

- **Agents SendMessage to TL only.** No lateral agent-to-agent messages unless TL explicitly routes a debate exchange.
- **Round 1 isolation**: Agents communicate only via SendMessage to TL. Do not write intermediate findings to shared discussion directories. Do not read files other agents may have written during this round.
- **TL routes all information.** TL decides what each agent sees and when.

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
3. Each Doodlestein agent SendMessage findings to TL (not directly to team — TL moderates)
4. TL routes challenges to ALL team members simultaneously (not Host-first — proposer's motivated defense should not be the primary input)
5. All agents must respond — no hiding
6. TL judges which challenges have merit. TL does not give proposer's response higher weight than opposition's independent assessment
7. Valid challenge → TL opens new rounds (all agents participate, including Doodlestein)
8. Refuted → TL records the exchange

---

## Debate Mode

For skills where decisions require adversarial challenge: ae:discuss, ae:consensus, ae:plan, ae:plan-review, ae:review.

### Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Moderator** | TL | Per Base Protocol |
| **Proposer** | One agent | Proposes positions, defends with evidence. Has opinions. Is NOT neutral. |
| **Opposition** | Other agents | Challenge proposer. Find flaws, demand evidence, present alternatives. |

**Critical rule**: Proposer must NEVER moderate, synthesize, or control the narrative. That is TL's job.

**Proposer selection** (per skill):
- ae:discuss → Host
- ae:plan / ae:plan-review → Architect (defends plan)
- ae:review → code-defender perspective
- ae:consensus → Advocate
- Skill SKILL.md specifies which agent is proposer

### Round Protocol (minimum 2 rounds)

#### Round 1 — Independent Research (no cross-talk)
- TL sends topic brief to all agents
- Each agent researches independently (reads code, finds evidence, forms position)
- Each agent reports findings to TL only
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
- Each agent reports findings to TL with evidence (file:line)

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

## Anti-Patterns

- **Proposer as moderator**: Letting proposer collect, summarize, or route messages. TL does this.
- **Agent as synthesizer**: Any agent producing the "final report" instead of TL. TL synthesizes.
- **Premature convergence** (debate mode): Agreeing after 1 round without genuine debate. Minimum 2 rounds; early-exit only with full explicit concession.
- **Evidence-free claims**: "I think X is better" without file:line citations. Dismissed.
- **Concession-free debate**: Agent that never concedes anything is not engaging honestly.
- **Killing dissenters**: Removing an agent because they disagree. Strong opinions are assets.
- **Round-per-team**: Spawning a new team each round. One team, one lifecycle.
- **Lateral messaging**: Agents SendMessage-ing each other directly, bypassing TL routing.
