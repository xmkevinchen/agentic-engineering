---
name: ae:consensus
description: Multi-agent structured debate (for/against/neutral) to evaluate proposals and decisions
argument-hint: "[--quick|--full] <proposal or decision to evaluate>"
---

# /ae:consensus — Structured Debate

Build multi-perspective consensus on: **$ARGUMENTS**

## Pre-check

1. Confirm `.claude/pipeline.yml` exists (needed for cross-family config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is `true`. If not enabled → **refuse to execute** and tell user: "Agent Teams is required. Add `{ \"experiments\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": true } }` to ~/.claude/settings.json and restart Claude Code."

## Step 0: Parse Mode

Parse `$ARGUMENTS` for mode flags:

- `--quick` → **Quick mode**: 3 agents only (advocate + critic + mediator), no cross-family, mediator skips evaluation and goes directly to synthesis after Round 1
- `--full` → **Full mode**: always trigger cross-examination regardless of signals, full 5-agent team
- No flag → **Adaptive mode** (default): mediator evaluates Round 1 output and decides whether to trigger cross-examination

Strip the flag from `$ARGUMENTS` before proceeding; the remainder is the proposal text.

## Step 1: Frame the Proposal

1. Read project CLAUDE.md and relevant code/docs
2. Formulate the proposal as a clear evaluatable statement
3. Identify what's at stake (reversibility, blast radius, complexity)

## Step 2: Agent Teams Debate — Round 1 (Independent Arguments)

Create a Team with explicit stances. **Lead: mediator** (collects and synthesizes). Each agent argues from their assigned position.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family** (skip if `--quick`): Read `cross_family` from pipeline.yml. Include enabled proxy agents as independent evaluators. If a proxy fails to connect, it MUST SendMessage to **mediator** using unavailability format: `## Position: UNAVAILABLE\nReason: [connection error]`. Mediator treats this as "agent absent" and proceeds without waiting further.

### Structured Output Schema

All agents MUST use this output structure in Round 1:

```
## Position: FOR / AGAINST / INDEPENDENT

### Claims
1. [Claim statement] — Evidence: [file:line or concrete data]
2. [Claim statement] — Evidence: [file:line or concrete data]

### Conceded Points
- [Points where the opposing position has merit]

### Unaddressed Opponent Points
[N/A in Round 1 — populated in Round 2]
```

### Team Creation

```
TeamCreate(team_name: "<topic>-consensus")

Agent(subagent_type: "architect", name: "advocate",
      team_name: "<team>", run_in_background: true,
      prompt: "STANCE: FOR. Argue in favor of this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: critic, mediator[, codex-proxy, gemini-proxy].
               YOU MUST use the structured output schema:
               ## Position: FOR
               ### Claims (each with file:line evidence)
               ### Conceded Points (where opponent is right)
               ### Unaddressed Opponent Points (N/A in Round 1)
               Present strongest arguments with evidence from codebase.
               Acknowledge weaknesses honestly in Conceded Points.
               SendMessage to mediator when done.
               IMPORTANT: STAY IN THE TEAM. Wait for cross-examination rounds.")

Agent(subagent_type: "challenger", name: "critic",
      team_name: "<team>", run_in_background: true,
      prompt: "STANCE: AGAINST. Argue against this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: advocate, mediator[, codex-proxy, gemini-proxy].
               YOU MUST use the structured output schema:
               ## Position: AGAINST
               ### Claims (each with file:line evidence)
               ### Conceded Points (where opponent is right)
               ### Unaddressed Opponent Points (N/A in Round 1)
               Find risks, hidden costs, better alternatives.
               Acknowledge strengths honestly in Conceded Points.
               SendMessage to mediator when done.
               IMPORTANT: STAY IN THE TEAM. Wait for cross-examination rounds.")

# Mediator — see Step 3 for full prompt (Phase 1 + Phase 2)
Agent(subagent_type: "simplicity-reviewer", name: "mediator",
      team_name: "<team>", run_in_background: true,
      prompt: "<see Step 3 below for complete mediator prompt>")

# Cross-family (skip if --quick):
Agent(subagent_type: "codex-proxy", name: "codex-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent evaluation of this proposal: <proposal + context>.
               Teammates: advocate, critic, mediator.
               YOU MUST use the structured output schema:
               ## Position: INDEPENDENT
               ### Claims (each with evidence)
               ### Conceded Points
               ### Unaddressed Opponent Points (N/A in Round 1)
               SendMessage findings to mediator when done.")

Agent(subagent_type: "gemini-proxy", name: "gemini-proxy",
      team_name: "<team>", run_in_background: true,
      prompt: "Independent evaluation of this proposal: <proposal + context>.
               Teammates: advocate, critic, mediator.
               YOU MUST use the structured output schema:
               ## Position: INDEPENDENT
               ### Claims (each with evidence)
               ### Conceded Points
               ### Unaddressed Opponent Points (N/A in Round 1)
               SendMessage findings to mediator when done.")
```

## Step 3: Mediator — Phase 1 (Evaluation) + Phase 2 (Synthesis)

The mediator has two clearly separated phases. The complete mediator prompt:

```
ROLE: NEUTRAL MEDIATOR. Evaluate debate on this proposal: <proposal>.
Follow Team Communication Protocol.
Teammates: advocate, critic[, codex-proxy, gemini-proxy].

You operate in two phases. Do NOT start Phase 2 until Phase 1 is complete.

═══ PHASE 1: EVALUATE (after Round 1) ═══

If MODE=quick → SKIP Phase 1 entirely. Proceed immediately to Phase 2.

Wait for advocate and critic to send their Round 1 output.
[If not --quick] Also wait for codex-proxy and gemini-proxy.
If any agent sends `## Position: UNAVAILABLE`, mark them absent and proceed without them.

Once all Round 1 inputs received, produce this EXACT evaluation block AND SendMessage it to BOTH the team lead AND the debate participants:

## Round 1 Summary
### Advocate (FOR)
- Key claims: [1-2 line summary of strongest claims]
- Conceded: [what advocate admitted]

### Critic (AGAINST)
- Key claims: [1-2 line summary of strongest claims]
- Conceded: [what critic admitted]

### Cross-family
- [1-line summary per proxy, or "N/A" if absent]

### Mediator Evaluation
- Has either side raised arguments the other hasn't addressed? YES/NO
- Are both sides' claims backed by concrete evidence (file:line, data, specific examples)? YES/NO
- ROUND_DECISION: CROSS_EXAMINE / SYNTHESIZE
- Reason: [one line]

Decision rules:
- MODE=quick → always SYNTHESIZE (skip this evaluation entirely, go to Phase 2)
- MODE=full → always CROSS_EXAMINE
- MODE=adaptive →
  - If "unaddressed arguments" = YES → CROSS_EXAMINE
  - If "evidence-backed" = NO → CROSS_EXAMINE
  - If both NO unaddressed + YES evidence-backed → SYNTHESIZE

If ROUND_DECISION = CROSS_EXAMINE → proceed to Cross-Examination Round.
If ROUND_DECISION = SYNTHESIZE → skip to Phase 2.

══ CROSS-EXAMINATION ROUND ══

Extract top 2-3 Claims from each side.
SendMessage to advocate: "Respond to critic's claims: [list]. For EACH claim: agree / partially agree / disagree + rationale."
SendMessage to critic: "Respond to advocate's claims: [list]. For EACH claim: agree / partially agree / disagree + rationale."

Wait for both responses.

After cross-examination, produce a Cross-Examination Summary AND SendMessage it to the team lead:

## Cross-Examination Summary
### Advocate responded to critic's claims:
| Claim | Response | Stance changed? |
|-------|----------|----------------|
| [claim] | [agree/partially/disagree + key rationale] | [yes/no] |

### Critic responded to advocate's claims:
| Claim | Response | Stance changed? |
|-------|----------|----------------|
| [claim] | [agree/partially/disagree + key rationale] | [yes/no] |

### Remaining disagreements: [list or "none"]

Then re-evaluate. Produce another Mediator Evaluation block (same EXACT format as Phase 1 — YES/NO questions + ROUND_DECISION + Reason).
Maximum 3 rounds total. After Round 3, MUST proceed to Phase 2 regardless.

═══ PHASE 2: SYNTHESIZE (Final Verdict) ═══

Produce the final verdict:

## Verdict

### Mode
[adaptive/quick/full] — [if adaptive: ROUND_DECISION reason]

### Mediator Evaluation
[Include the final evaluation block from Phase 1]

### Cross-examination Summary
[If cross-examination occurred: per-claim response summary table]
[If skipped: "Skipped — [reason from evaluation]"]

### Consensus Assessment
- **Consensus**: all sides agree → proceed / reject
- **Majority**: 2/3+ agree → proceed with noted risks
- **Split**: no clear winner → present both paths, ask user to decide

### Strongest argument for
[one paragraph]

### Strongest argument against
[one paragraph]

### Cross-family perspective
[summary of independent evaluations, if available]

### Final recommendation
[clear recommendation with rationale]

```

## Step 4: Verdict & Persist

Write verdict directly to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-consensus-slug.md`.

The verdict file includes:
- Mode used (adaptive/quick/full)
- Mediator evaluation block(s)
- Cross-examination exchange summary (if occurred)
- Final recommendation

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show verdict to user.

Close the Team.
