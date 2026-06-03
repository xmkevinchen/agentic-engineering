---
name: ae:consensus
description: Multi-agent structured debate (for/against/neutral) to evaluate proposals and decisions
argument-hint: "[--quick|--full] <proposal or decision to evaluate>"
user-invocable: true
effort: medium
---

<!-- ae-output-standards-pointer-v1 -->
Adhere to [AE Output Standards](../../output-standards.md) in verdict formatting and TL session responses.
<!-- /ae-output-standards-pointer-v1 -->

# /ae:consensus — Structured Debate

Build multi-perspective consensus on: **$ARGUMENTS**

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:consensus creates exactly **3 tasks** per invocation (1 Pre-check + Debate + Synthesis). Frame / Decision Record / Output are sub-actions of synthesis — no separate tasks.

| Phase | When created | When `in_progress` | When `completed` |
|---|---|---|---|
| `ae:consensus: Pre-check` | At skill start | Immediately before pre-check 1 | After pre-checks pass (control reaches Step 1 Frame) |
| `ae:consensus: Debate (Rounds 1+2)` | At skill start (batch) | When the first debate agent (architect/challenger/proxy) is spawned | When all spawned debate agents have returned findings at TL (Round 2 cross-examination optional — task closes when no further debate rounds are scheduled) |
| `ae:consensus: Synthesis` | At skill start (batch) | When TL begins merging positions + writing verdict | When verdict + Decision Record persisted |

At skill start, batch-create:

```
TaskCreate(subject: "ae:consensus: Pre-check")
TaskCreate(subject: "ae:consensus: Debate (Rounds 1+2)")
TaskCreate(subject: "ae:consensus: Synthesis")
```

In `--quick` mode (cross-family proxy skipped): Debate task still fires for the 2 Claude-native agents (architect + challenger); Synthesis unchanged.

**Task lifecycle**: at skill start, immediately after the TaskCreate for `ae:consensus: Pre-check`, call `TaskUpdate(taskId, status: "in_progress")`.
After pre-checks pass, call `TaskUpdate(taskId, status: "completed")`.
Same lifecycle applies to Debate and Synthesis phase tasks — `TaskUpdate(taskId, status: "in_progress")` when the phase begins, `TaskUpdate(taskId, status: "completed")` when the phase's completion criterion is met.

**Owner field**: omit. **On error**: stay `in_progress` (per agent-teams §C/§D).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists (needed for cross-family config)
2. If missing → tell user "First time using ae plugin, initializing project config..." then auto-run `/ae:setup` flow inline. After setup completes, continue with the original command.
3. **Agent Teams**: Read `~/.claude/settings.json` → check `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set. If not enabled → **refuse to execute** and tell user: "Agent Teams is required for `/ae:consensus` (mediation between agents — see `docs/agent-teams-policy.md` for the Framing A carve-out rationale). Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

## Step 0: Parse Mode

Parse `$ARGUMENTS` for mode flags:

- `--quick` → **Quick mode**: advocate + critic only, no cross-family. TL skips Phase 1 evaluation and goes directly to Phase 2 synthesis after Round 1
- `--full` → **Full mode**: always trigger cross-examination regardless of signals, full team (advocate + critic + cross-family)
- No flag → **Adaptive mode** (default): TL evaluates Round 1 output and decides whether to trigger cross-examination

Strip the flag from `$ARGUMENTS` before proceeding; the remainder is the proposal text.

## Step 1: Frame the Proposal

1. Read project CLAUDE.md and relevant code/docs
2. Formulate the proposal as a clear evaluatable statement
3. Identify what's at stake (reversibility, blast radius, complexity)

## Step 2: Agent Teams Debate — Round 1 (Independent Arguments)

Create a Team with explicit stances. **TL = mediator** (collects, evaluates, and synthesizes). Each agent argues from their assigned position.

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family** (skip if `--quick`): Read `cross_family` from pipeline.yml. Include enabled proxy agents as independent evaluators. Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback. If proxy ultimately unavailable (after fallback), TL treats as "agent absent" and proceeds.

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

**Before `TeamCreate`** — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

```
TeamCreate(team_name: "<topic>-consensus")

Agent(subagent_type: "architect", name: "advocate",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: architect
                  Role: advocate (for/against debate, FOR position)
                  Angle: strongest arguments + codebase evidence supporting the proposal
                  Why: structured debate requires committed advocate position

               STANCE: FOR. Argue in favor of this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: critic[, <enabled proxies>].
               YOU MUST use the structured output schema:
               ## Position: FOR
               ### Claims (each with file:line evidence)
               ### Conceded Points (where opponent is right)
               ### Unaddressed Opponent Points (N/A in Round 1)
               Present strongest arguments with evidence from codebase.
               Acknowledge weaknesses honestly in Conceded Points.
               SendMessage to team-lead when done.
               IMPORTANT: STAY IN THE TEAM. Wait for cross-examination rounds.")

Agent(subagent_type: "challenger", name: "critic",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: challenger
                  Role: opposition (critic in for/against debate, AGAINST position)
                  Angle: risks + hidden costs + better alternatives
                  Why: structured debate requires committed critic position (F-019 challenger.md migration: critic-mode behavior embedded here, not in agent body)

               Critic-in-consensus mode protocol steps (embedded per F-019 mode migration):
               1. Find risks, hidden costs, and better alternatives to the proposal.
               2. Use structured output schema (Position: AGAINST + Claims with file:line + Conceded Points + Unaddressed).
               3. Acknowledge opponent strengths honestly in Conceded Points (not a refusal protocol — concessions are signal).
               4. Stay in team for cross-examination rounds with advocate; respond to advocate's claims with evidence.

               STANCE: AGAINST. Argue against this proposal: <proposal + context>.
               Follow Team Communication Protocol.
               Teammates: advocate[, <enabled proxies>].
               YOU MUST use the structured output schema:
               ## Position: AGAINST
               ### Claims (each with file:line evidence)
               ### Conceded Points (where opponent is right)
               ### Unaddressed Opponent Points (N/A in Round 1)
               Find risks, hidden costs, better alternatives.
               Acknowledge strengths honestly in Conceded Points.
               SendMessage to team-lead when done.
               IMPORTANT: STAY IN THE TEAM. Wait for cross-examination rounds.")

# No mediator agent — TL acts as mediator (see Step 3)

# Cross-family (skip if --quick):
# For each enabled proxy (check pipeline.yml cross_family):
# TL picks angles first, assigns to available proxies. If both enabled, different angles.
Agent(subagent_type: "<proxy>", name: "<proxy>",
      team_name: "<team>", run_in_background: true,
      prompt: "📋 Cast: <proxy>
                  Role: cross-family independent evaluator (<family> angle)
                  Angle: <assigned-angle-at-spawn-time>
                  Why: pipeline.yml cross_family enabled; breaks for/against deadlock with independent perspective

               Independent evaluation of this proposal from <assigned angle>: <proposal + context>.
               Teammates: advocate, critic.
               YOU MUST use the structured output schema:
               ## Position: INDEPENDENT
               ### Claims (each with evidence)
               ### Conceded Points
               ### Unaddressed Opponent Points (N/A in Round 1)
               SendMessage findings to team-lead when done.")
```

## Step 3: TL Mediates — Phase 1 (Evaluation) + Phase 2 (Synthesis)

TL acts as neutral mediator. Two clearly separated phases.

### Phase 1: Evaluate (after Round 1)

If MODE=quick → SKIP Phase 1 entirely. Proceed immediately to Phase 2.

Wait for advocate and critic to send their Round 1 output.
[If not --quick] Also wait for enabled proxy agents.
If any agent sends `## Position: UNAVAILABLE`, mark them absent and proceed without them.

Once all Round 1 inputs received, produce this EXACT evaluation block. Retain it for Phase 2 synthesis, AND SendMessage it to the debate participants:

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

(`ROUND_DECISION` and this evaluation block are TL-internal routing state — they MUST NOT appear in the user-facing verdict; see output-standards.md Rule C.)

Decision rules:
- MODE=quick → always SYNTHESIZE (skip this evaluation entirely, go to Phase 2)
- MODE=full → always CROSS_EXAMINE
- MODE=adaptive →
  - If "unaddressed arguments" = YES → CROSS_EXAMINE
  - If "evidence-backed" = NO → CROSS_EXAMINE
  - If both NO unaddressed + YES evidence-backed → SYNTHESIZE

If ROUND_DECISION = CROSS_EXAMINE → proceed to Cross-Examination Round.
If ROUND_DECISION = SYNTHESIZE → skip to Phase 2.

### Cross-Examination Round

TL extracts top 2-3 Claims from each side.
SendMessage to advocate: "Respond to critic's claims: [list]. For EACH claim: agree / partially agree / disagree + rationale."
SendMessage to critic: "Respond to advocate's claims: [list]. For EACH claim: agree / partially agree / disagree + rationale."

Wait for both responses.

After cross-examination, produce a Cross-Examination Summary:

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

### Phase 2: Synthesize (Final Verdict)

TL produces the final verdict:

The verdict is a judgment, not a process record (output-standards.md Rule C) — no mode labels, no evaluation blocks, no round bookkeeping:

```markdown
## Recommendation

**Recommend**: [Proceed/Reject/Modify/Deadlocked — both paths below, your call] — [one-line why]

[2-3 sentence rationale: what tipped the judgment, citing the strongest evidence]

**Verdict**: [Confirmed / Overturned / Deadlocked — the debate outcome in one word]
**Strongest argument for**: [one paragraph]
**Strongest argument against**: [one paragraph + how the recommendation handles it]
**Key risks**: [what this decision accepts + mitigation]
**Next action**: [specific step]

### Supporting detail (audit trail)
[cross-family perspective if available; per-claim cross-examination summary if it occurred;
 Deadlocked case: present both paths with evidence + your leaning — the user decides]

## Agent Selection Trace
[verbatim [layer1]/[layer2] trace lines — required appendix per ae:agent-teams persisted-report contract]
```

Worked example (the shape implementers should produce — judgment first, no process bookkeeping):

```markdown
## Recommendation

**Recommend**: Proceed — migrating to SQLite WAL mode is low-risk and removes our top contention bug.

Both sides agreed the failure modes are bounded; the critic's strongest objection (WAL sidecar
files breaking naive file-copy backups) is already handled by our `.backup`-API script.
Adopting now removes the lock-contention class behind 3 recent incidents.

**Verdict**: Confirmed — the direction survived cross-examination.
**Strongest argument for**: WAL eliminates writer-blocks-readers, our measured top contention source.
**Strongest argument against**: WAL sidecar files break naive file-copy backups — handled: backup script already uses the `.backup` API, and its cadence bounds worst-case data loss to one interval.
**Key risks**: NFS mounts unsupported (we deploy on local disk only); accepted.
**Next action**: flip the pragma in the connection factory + add a migration note.
```

## Step 4: Verdict & Persist

Write verdict directly to `pipeline.yml` → `output.analyses` (default: `.ae/analyses/`) as `NNN-consensus-slug.md`.

The verdict file = the `## Recommendation` template above (judgment-first; process bookkeeping like mode labels and evaluation blocks stays out of it — output-standards.md Rule C), PLUS the required `## Agent Selection Trace` appendix (verbatim [layer1]/[layer2] lines per the ae:agent-teams persisted-report contract). The `### Supporting detail (audit trail)` section carries the cross-examination summary and cross-family perspective when they exist.

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show verdict to user.

Close the Team.

## Next Steps

Based on consensus outcome, suggest:
- If verdict is clear → "Use this verdict to inform `/ae:discuss` or `/ae:plan` decisions"
- If verdict is split → "Consider `/ae:think` for deeper analysis on the contested points"
