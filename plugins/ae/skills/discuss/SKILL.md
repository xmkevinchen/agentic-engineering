---
name: ae:discuss
description: Structured design discussion (create topics or continue pending ones, all decisions persisted). Recommended: Sonnet or above
argument-hint: "<topic description or discussion directory path>"
user-invocable: true
model: opus
effort: high
---

<!-- ae-output-standards-pointer-v1 -->
Adhere to [AE Output Standards](../../output-standards.md) in discussion formatting and TL session responses.
<!-- /ae-output-standards-pointer-v1 -->

**Protocol Map** — if detail for any step is missing below, read this SKILL.md file directly before proceeding.
Steps: 1.Setup → 2.Spawn Team → 3.Discussion Rounds → 4.Consensus Verification → 5.TL Scores → 6.Present & Record → 7.Sweep → 8.Conclusion → 9.Doodlestein (post-conclusion) → 10.Shutdown

## Argument Inference

If `$ARGUMENTS` is empty:
1. Check `output.discussions` (default: `.ae/discussions/`) for any discussion with `status: active` (has pending topics)
2. Found → continue that discussion
3. Not found → check conversation context for a topic being discussed
4. Still nothing → ask user what to discuss

# /ae:discuss — Design Discussion

Start a structured design discussion for: **$ARGUMENTS**

## Discussion Flow

```
Setup → Spawn Team → Discussion Rounds → Doodlestein → Sweep → Conclusion → Shutdown
                          ↑ │
                          └── revisit topics ───┘
```

Read `pipeline.yml` → `output.discussions` for the base directory.

File format templates are in the Appendix at the end of this file.

## Task progress tracking

Per `plugins/ae/skills/agent-teams/SKILL.md` → `## Skill step progress tracking`. ae:discuss creates 8 tasks per invocation. Steps 4-6 (Consensus / TL Scores / Present) and Step 10 (Shutdown) are deliberately excluded — sub-actions or too short.

| Phase | Subject | Created at | `in_progress` | `completed` |
|---|---|---|---|---|
| Pre-check | `ae:discuss: Pre-check` | Skill start | Before pre-check 1 | After pre-checks pass |
| Step 1 Setup | `ae:discuss: Step 1 — Setup` | Skill start (batch) | When discussion dir resolved | After framing.md + index.md written |
| Step 1.5 Round 0 | `ae:discuss: Step 1.5 — Round 0 Framing` | Skill start (batch) | When framing-review team spawned | After Round 0 verdicts aggregated + verdict files written + framing-review teammates shut down |
| Step 2 Spawn | `ae:discuss: Step 2 — Spawn Team` | Skill start (batch) | When discussion council team spawned | When all council members report ready for Round 1 |
| Step 3 Discussion | `ae:discuss: Step 3 — Discussion Rounds` | Skill start (batch) | When Round 1 starts | When all topics converged or deferred |
| Step 7 Sweep | `ae:discuss: Step 7 — Sweep Deferred` | Skill start (batch) | When Sweep starts | When zero deferred + zero revisit |
| Step 8 Conclusion | `ae:discuss: Step 8 — Generate Conclusion` | Skill start (batch) | When conclusion synthesis starts | When conclusion.md written + entities extracted |
| Step 9 Doodlestein | `ae:discuss: Step 9 — Doodlestein` | Skill start (batch) | When 4 Doodlestein agents spawned | When all 4 replies received + actions taken |

At skill start, batch-create:

```
TaskCreate(subject: "ae:discuss: Pre-check")
TaskCreate(subject: "ae:discuss: Step 1 — Setup")
TaskCreate(subject: "ae:discuss: Step 1.5 — Round 0 Framing")
TaskCreate(subject: "ae:discuss: Step 2 — Spawn Team")
TaskCreate(subject: "ae:discuss: Step 3 — Discussion Rounds")
TaskCreate(subject: "ae:discuss: Step 7 — Sweep Deferred")
TaskCreate(subject: "ae:discuss: Step 8 — Generate Conclusion")
TaskCreate(subject: "ae:discuss: Step 9 — Doodlestein")
```

Owner field: omit. On error: stay `in_progress`. Steps 4-6 and 10 are sub-actions of their containing phases — no separate tasks.

## Pre-check

1. **Agent Teams**: Run `check-agent-teams.sh` (exit 0 = available; exit 1 = unavailable, prints the reason). If exit 1 → **refuse to execute** and tell user: "Agent Teams is required for `/ae:discuss` (debate protocol — see `docs/agent-teams-policy.md` for the Framing A carve-out rationale). Add `{ \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }` to ~/.claude/settings.json and restart Claude Code."

## Step 1. Setup

1. **Resolve discussion directory** — apply the **Feature context resolution** rule defined in `plugins/ae/skills/plan/SKILL.md` Step 2. Both skills MUST use identical resolution semantics; do NOT restate the rule here in different words. Resolution outcomes:
   - `$ARGUMENTS` points to an existing directory → load its `index.md`.
   - `$ARGUMENTS` resolves to a feature dir (BL-NNN promoted, feature dir path, or unambiguous title-overlap with `.ae/features/{active,paused}/F-NNN-<slug>/`) → write target = `<feature-dir>/discussions/<NNN>-<slug>/` (one discussion per topic family inside the feature). Existing topic dir under that feature → add topics to it; otherwise create a new one.
   - `$ARGUMENTS` does NOT resolve to a feature (free-text discussion not tied to a feature) → write target = `<output.discussions>/NNN-slug/` per existing convention (legacy fallback).
2. **If new discussion**: create two files in the directory:
   - `index.md` — minimal scaffolding (title, pipeline status, topic list placeholder, links). On feature-internal discussions, the `index.md` frontmatter MAY include optional `feature: F-NNN` (path-derived; validation-only — `ae:dashboard` reading discussion state flags mismatch when frontmatter conflicts with parent dir path; no automatic relocation).
   - `framing.md` — **separate file** containing Problem Statement. Describe the problem to be solved; do NOT pre-commit to solution directions, list option A/B/C, or embed specific mechanisms. Framing will be reviewed in Step 1.5 before Round 1 spawns.
3. **If existing**: show convergence status:
   ```
   📊 Discussion NNN: N topics
   - converged: X ✅ revisit: Y 🔄 deferred: Z ⏳ pending: W
   ```
4. **Route**:
   - All converged + no deferred → go to Sweep (step 7) / Conclusion (step 8) / Doodlestein (step 9)
   - Has revisit or pending → Step 1.5 (new discussion or framing changed) or Step 2 (resume)

### 1.4. Writing the `## User Question (Frozen)` section

When creating `framing.md` (per Step 1 item 2), TL fills the `## User Question (Frozen)` section (defined in the Appendix `framing.md` template) with the user's invocation message **verbatim**. Verbatim = byte-exact copy including original whitespace, line breaks, and formatting markers (e.g., bullet markers, code fences). TL MUST NOT:

- Summarize, condense, or extract "the key points" — even if invocation is long
- Translate the user's language into a different language
- Normalize formatting (e.g., wrapping prose, removing typos, "cleaning up" markdown)
- Add explanatory wrapping ("The user is asking...") in lieu of direct quote

If the invocation message is too long to copy in full and exceeds practical context budget, TL **stops and asks the user** which subset to freeze (typical scope: the actual question, not the surrounding chat). User explicitly chooses the frozen content; TL never silently truncates.

This constraint exists because every downstream guard (§1.5.1 Frozen-field rule, §1.5.3 Rule 1.5 byte-diff check) compares against this section's text. If the section is already a TL paraphrase, the guards compare two copies of the paraphrase — false sense of security.

### 1.5. Round 0 — Framing Review (new discussions only)

**Framing quality review is its own task**, with its own spawn/shutdown lifecycle, distinct from Step 2's discussion-rounds task. Two tasks = two sequential teammate groups within the session's one implicit team — framing-review teammates shut down before the council spawns; it is not a pre-flight hack.

**Path note**: throughout sections 1.5.x and 2-8 below, the symbolic `<discussion-dir>` resolves to whichever path Step 1 chose. For feature-internal discussions, `<discussion-dir>` = `<feature-dir>/discussions/<NNN>-<slug>/`; for free-text discussions, `<discussion-dir>` = `<output.discussions>/NNN-slug/` (legacy fallback). Round-00, round-NN, and conclusion files all live under `<discussion-dir>/` regardless of which location was resolved.

**Goal**: catch three failure modes before Round 1 anchors on the framing:
1. **Bias anchoring** — framing reflects TL's pre-commitments → caught by cross-family peer review
2. **Scope narrowing** — framing forecloses Round 1 solution classes → caught by Doodlestein strategic + adversarial
3. **Over-complication** — framing complicates the problem → caught by engineering-minimal-change-engineer's refuse-scope-creep discipline

Applies to **new discussions** and any discussion where `framing.md` was changed. Skip for pure resumes.

**TL first writes the `framing.md` draft** (standard problem statement — no pre-committed mechanisms), then opens the review task.

#### 1.5.1. Spawn framing-review team

**Before spawning teammates** (applies to BOTH framing-review team here AND Step 2 council team) — emit Layer 1 + Layer 2 selection trace per `ae:agent-teams` Base Protocol § Selection Trace Emission (default-ON, no flag; format spec in `ae:agent-selection` SKILL.md).

**Preflight — project agent presence check**: before spawning teammates, verify that the minimal-change-engineer agent exists. Discovery order (first match wins):
- `plugins/ae/agents/engineering/minimal-change-engineer.md` (plugin built-in — default location since F-011)
- `.claude/agents/engineering-minimal-change-engineer.md` (project-local override, optional)
- `~/.claude/agents/engineering-minimal-change-engineer.md` (user override, optional)

If not found in any location, **do NOT silently degrade quorum**. Instead, surface the choice via `AskUserQuestion` with exactly two options (no "install agent now" option — AE has no in-skill auto-install capability; offering it would misrepresent what the skill can do):

1. **Continue with reduced 4-agent quorum (3-of-4 threshold)** — accept the loss of over-complication detection coverage for this discussion; Round 0 runs with 2 cross-family + 2 Doodlestein.
2. **Abort discussion** — TL output includes the install command string `/ae:setup agents --add engineering-minimal-change-engineer` (or instructs user to drop the agent file under `.claude/agents/`), then refuses to proceed.

Emit one of the following trace lines based on the user's choice (replaces the previous unconditional emit):

- User chose continue: `[layer1] preflight: minimal-change-engineer agent NOT FOUND; user disposition: continue. Round 0 will run with 4 agents (2 cross-family + 2 Doodlestein). Quorum threshold reduces to 3 of 4. Over-complication detection coverage is LOST for this discussion.`
- User chose abort: `[layer1] preflight: minimal-change-engineer agent NOT FOUND; user disposition: abort. Discussion aborted; install command emitted to user.`

When user chooses continue, proceed with the 4-agent path (2 cross-family + 2 Doodlestein) and the 3-of-4 quorum threshold — the existing escape hatch is preserved; only the silent-default behavior is removed.

**Note**: the framing_context convention below is a **prompt-embedded key**, not an `Agent(...)` parameter. All 5 (or 4) spawn prompts must include the line `framing_context: <discussion-dir>/framing.md` at the top of their prompt string so the agent reliably locates the review target.

**Frozen-field rule** (applies to all 5 reviewer prompts):
Reviewers may critique TL-authored framing, but the `## User Question (Frozen)` section is immutable.
- Sacred portion = exact contents of `## User Question (Frozen)` (byte-exact, including whitespace and line breaks)
- Mutable scope = TL-authored `Problem Statement`, `Scope`, `Reference Material`
- A legal `REVISE` finding's `suggested edit:` must target only mutable sections
- Wording-only changes to the Frozen section are still invalid; semantic equivalence is irrelevant — do not paraphrase, normalize, translate, narrow, or broaden the Frozen section under any circumstance

Each spawn prompt below echoes this rule by including the line `Honor the Frozen-field rule defined in §1.5.1 above.` immediately under its `framing_context:` line, so the agent's prompt context carries the constraint without re-stating the full rule.

Parallel spawn of 5 reviewers (4 if preflight dropped minimal-change-engineer), each with `framing_context:` in the prompt:

```
Agent(subagent_type: "ae:workflow:codex-proxy", name: "codex-proxy",
      run_in_background: true,
      prompt: "📋 Cast: codex-proxy
                  Role: framing reviewer (OpenAI angle)
                  Angle: bias anchoring
                  Why: cross-family check for TL pre-commitments before Round 1 begins

               framing_context: <discussion-dir>/framing.md
               Honor the Frozen-field rule defined in §1.5.1 above.
               Review angle: bias anchoring. Read ONLY the framing file.
               Does this framing embed TL's pre-commitments (specific mechanisms,
               ruled-out alternatives, loaded language)? Report verdict: APPROVED
               / REVISE: <specific issue> | target: <Problem Statement | Scope | Reference Material> | suggested edit: <concrete revision for mutable target only>.
               If MCP connection fails / times out / rate-limited / quota exhausted,
               SendMessage 'unavailable: <reason>' to team-lead and exit.
               Do not retry. SendMessage verdict to team-lead.")

Agent(subagent_type: "ae:workflow:gemini-proxy", name: "gemini-proxy",
      run_in_background: true,
      prompt: "📋 Cast: gemini-proxy
                  Role: framing reviewer (Google angle)
                  Angle: bias anchoring (system-level lens)
                  Why: cross-family check complements OpenAI angle; gemma4 fallback per CLAUDE.md

               framing_context: <discussion-dir>/framing.md
               Honor the Frozen-field rule defined in §1.5.1 above.
               Review angle: bias anchoring (Google-family lens; if Gemini API
               unavailable, fall back to local gemma4:26b per CLAUDE.md).
               Read ONLY the framing file. Report verdict per the 3-state format.
               If MCP connection fails / times out / rate-limited / quota exhausted
               (and gemma4 fallback also fails), SendMessage 'unavailable: <reason>'
               to team-lead and exit. Do not retry.
               SendMessage verdict to team-lead.")

Agent(subagent_type: "ae:workflow:doodlestein-strategic", name: "doodlestein-strategic-framing",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-strategic-framing
                  Role: framing reviewer (strategic)
                  Angle: scope narrowing — alternative framings foreclosed
                  Why: catch TL framing biases before they propagate to Round 1

               framing_context: <discussion-dir>/framing.md
               Honor the Frozen-field rule defined in §1.5.1 above.
               Review angle: scope narrowing. Read ONLY the framing file.
               What is the single smartest improvement to this framing — especially
               any alternative framing that was foreclosed by the current wording?
               Report APPROVED if framing is open; REVISE with a concrete alternative
               if a better framing exists. SendMessage verdict to team-lead.")

Agent(subagent_type: "ae:workflow:doodlestein-adversarial", name: "doodlestein-adversarial-framing",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-adversarial-framing
                  Role: framing reviewer (adversarial)
                  Angle: Round 1 walls — first blocked solution class
                  Why: predict downstream Round 1 friction before commitment

               framing_context: <discussion-dir>/framing.md
               Honor the Frozen-field rule defined in §1.5.1 above.
               Review angle: Round 1 scope narrowing. Read ONLY the framing file.
               If Round 1 agents researched independently under this framing, what is
               the first solution class they would hit a wall on? Report APPROVED
               if no obvious wall; REVISE with the blocked solution class if one exists.
               SendMessage verdict to team-lead.")

Agent(subagent_type: "ae:engineering:minimal-change-engineer", name: "minimal-change-engineer",
      run_in_background: true,
      prompt: "📋 Cast: minimal-change-engineer
                  Role: framing reviewer (over-complication detection)
                  Angle: simpler framing covering same problem with less machinery
                  Why: anti-over-engineering check before TL commits to mechanism

               framing_context: <discussion-dir>/framing.md
               Honor the Frozen-field rule defined in §1.5.1 above.
               Review angle: problem over-complication / scope creep. Read ONLY the framing file.
               Is this framing bigger than the problem requires? Is there a simpler
               framing that covers the same problem with less machinery?
               Report APPROVED if minimal; REVISE with the simpler framing if one exists.
               SendMessage verdict to team-lead.")
```

#### 1.5.2. Wait for verdicts + timeout

TL waits for **all 5 verdicts** before aggregating. **No early-exit on first REVISE** — in-flight agents must complete or time out.

**Timeout rules**:
- Proxy agents (`codex-proxy`, `gemini-proxy`): 120s per agent, per `plugins/ae/skills/agent-selection/SKILL.md` Proxy Timeout Protocol. On timeout the proxy must SendMessage `unavailable: timeout` and exit.
- Claude-native agents (`doodlestein-strategic-framing`, `doodlestein-adversarial-framing`, `ae:engineering:minimal-change-engineer`): 180s wall-clock each. If a Claude-native agent does not respond within 180s, TL treats it as `unavailable: timeout`. **Missing verdict is NEVER implicit APPROVED.**

#### 1.5.3. Verdict aggregation

Each verdict is one of three states:
- `APPROVED: <one-line reason>`
- `REVISE: <specific issue> | target: <Problem Statement | Scope | Reference Material> | suggested edit: <concrete revision for mutable target only>`
- `unavailable: <reason>` (proxy or Claude-native, from timeout or MCP failure)

The `target:` field is required on REVISE verdicts and MUST be one of the 3 mutable section names. `target: User Question (Frozen)` is invalid (sacred section is immutable; see §1.5.1 Frozen-field rule). Rule 1.5 below validates this field and the `suggested edit:` content before consolidation.

**Aggregation rules** — apply in this exact order; first match wins:

1. **Quorum check** (precondition): a majority of **spawned** agents must return `APPROVED` or `REVISE` (non-`unavailable`). Thresholds: ≥3 of 5 (standard spawn), or ≥3 of 4 (preflight dropped minimal-change-engineer). Below the threshold → halt, report to user "framing-review quorum not reached; cannot assess. Retry or skip Round 0?" Stop; no further rules apply.

   1.5. **Frozen-section integrity check** (precondition: Rule 1 quorum met): for each REVISE verdict, validate sequentially:
   1. `target:` field is present AND value is one of `Problem Statement | Scope | Reference Material`. Missing field, malformed value, or `target: User Question (Frozen)` → mark verdict invalid; log: `[FRAMING-REVIEW] invalid REVISE from <agent>: target missing or = Frozen section.`
   2. `suggested edit:` content does not propose changes to text inside the `## User Question (Frozen)` section. TL byte-for-byte compares the current frozen-section text against any post-suggestion preview. **Do not judge semantic equivalence; wording-only changes are still invalid.** Mismatch → mark verdict invalid; log: `[FRAMING-REVIEW] frozen-section check: mismatch from <agent>` (else log `unchanged` for audit trail).

   Invalid verdicts are **dropped entirely** — no rephrase / recovery. If the user later picks Revise option in Rule 2, the next Round 0 spawns fresh agents who can resubmit findings in correct format.

   If after this filter all REVISE verdicts are invalidated, treat as zero REVISE; proceed to Rules 3-4 (cross-family degraded check / unanimous APPROVED).

2. **Any REVISE** (after Rule 1.5 filtering) → TL first classifies the valid REVISE set, then routes to one of two branches (this classification is internal to Rule 2 — the rule-ordering and first-match-wins semantics of Rules 1–4 are unchanged):

   **(a) Convergent-REVISE fast path** — fires only when ALL three conditions hold: ① 方向收敛互不冲突 (all suggested edits point the same direction, none contradict another); ② 无需用户独有判断 (no REVISE requires a business/preference call only the user can make); ③ 不实质改动框架结构 (TL can integrate each edit faithfully; the integration is wording/supplement-level, not structural — calibration evidence: F-036/F-037 reruns where deltas had shrunk to wording level were pure churn, while F-037's FIRST run had substantive REVISEs that merited a rerun).
   - **Structural diff gate** (mechanical pre-commit check, after the three-condition judgment, before announcing): diff the integrated framing against the pre-integration version. Demote to the contested path automatically (no override, no user prompt) if **the diff adds, removes, or renames any section heading** (structural = the section structure itself changed) OR **any section grows >30% in line count AND by more than 5 lines absolute** (the absolute floor keeps single-sentence additions to short sections inside the fast path); log `[FAST-PATH DEMOTED: diff exceeded structural bound]`. This makes the `not_structural:` record evidence, not assertion. (Bounds recalibrated at F-038 review: a section-count bound would demote legitimate multi-section wording integrations — the F-037 case this fast path exists to serve.)
   - On pass: TL integrates the edits (`## User Question (Frozen)` byte-for-byte preserved, as in every rewrite), sets `round_0: integrated_no_rerun`, and writes a structured three-condition record into `round_0_notes` with three labeled entries: `convergent:` (each REVISE theme + why they coexist), `no_user_call:` (why no user judgment was needed), `not_structural:` (which integrations were wording/supplement-level; cite the diff-gate numbers).
   - Announce to the user (Standard 2 three-line form — the user's correction window needs the delta visible):
     ```
     ## Round 0: convergent revisions integrated
     - [N] 条收敛修订已整合:<逐条一行清单>
     - 快速通过依据:方向一致、无需你裁决、不动框架结构
     - 即将进入下一步——有异议现在说。
     ```
     Then proceed to Step 1.6 — but do NOT spawn the Step 2 council in the same turn as this announcement: the council spawn waits for the next turn boundary, so the announcement reaches the user before the discussion goes live. An objection arriving before the council spawn reroutes to the contested path. No mandatory rerun.
   - **auto-revert**: if during Round 1 ≥2 agents re-raise a framing objection on a fast-path-integrated point (sign of a mis-classified substantive disagreement), TL immediately re-runs Round 0 via the contested path and files a BL to tighten the three conditions.

   **(b) Contested path** — REVISEs conflict with each other, OR any requires a user-owned decision, OR integration would materially reshape the framing (or the diff gate demoted): halt. Set `round_0: revise_requested` in `framing.md` frontmatter, populate `round_0_notes` with consolidated REVISE feedback across all responding agents (only valid REVISE verdicts that survived Rule 1.5). Present consolidated list to user with options:
   - **Revise**: TL rewrites `framing.md` per feedback, re-runs Round 0 (will transition `round_0` to `approved` or back to `revise_requested`). TL rewrite — scope, terminology, and structure only. **MUST NOT alter `## User Question (Frozen)` section: byte-for-byte preserved across re-runs.**
   - **Override**: skip Round 0 outcome for this discussion. Log `round_0: overridden` with user-supplied reason. Proceed to Step 1.6.
   - **Cancel**: abort discussion
3. **Cross-family degraded** (precondition: rules 1–2 passed, i.e. quorum met and zero REVISE; at this point all available verdicts are APPROVED) — BOTH `codex-proxy` and `gemini-proxy` returned `unavailable`:
   - Bias-anchoring coverage is zero. **Do NOT auto-approve.** Halt and present to user:
     - Current: 3 Claude-family reviewers all APPROVED; both cross-family reviewers unavailable.
     - Options:
       - **Accept degraded**: log `round_0: approved (cross-family-degraded)` in frontmatter, proceed. User explicitly accepts the reduced bias-anchoring coverage.
       - **Retry**: re-spawn both proxies (they may recover).
       - **Cancel**: abort discussion.
4. **Unanimous APPROVED with full coverage** — at least one cross-family proxy returned `APPROVED` AND all non-`unavailable` verdicts are `APPROVED`:
   - Log `round_0: approved` in `framing.md` frontmatter, write per-agent verdict files, proceed to Step 1.6.

**Rerun limit** (separate from aggregation — applies to the outer loop driven by Rule 2's Revise option): if the user selects **Revise + rerun** 3 consecutive times without the framing converging to APPROVED, escalate to the user rather than looping further. This is not an aggregation rule (single-run aggregation has no loop; all verdicts arrive in one batch).

Rationale for rule order (addresses review-043 P1s): rule 1.5 fires before rule 2 because the mechanical guard (target validation + frozen-section byte-diff) must filter invalid REVISE verdicts before the user-facing halt — otherwise the user sees consolidated feedback derived from invalid REVISE proposals. Rule 2 fires before rule 3/4 so any REVISE is dispositioned cleanly (fast-path integration or contested halt). Rule 3 is checked before rule 4 so the "both cross-family down" case is caught explicitly — previously rule 4 was unreachable because its precondition (all APPROVED of available) was already covered by rule 2. Rule 3 is a halt-and-ask, not an auto-approve, because automatically proceeding when bias-anchoring coverage has collapsed to zero defeats Round 0's primary goal.

#### 1.5.4. Per-agent verdict files + teammate shutdown

After aggregation:
- **Verdict files first** — write each agent's verdict (including `unavailable` and timed-out entries) to `<discussion-dir>/round-00/<agent-name>.md` (create dir if needed). File contents: agent name, verdict state, verdict content verbatim, timestamp. These files are the durable audit trail — captured BEFORE any `shutdown_request` is sent so a hung or timed-out agent still has its record written. Agents already marked `unavailable` by §1.5.2 timeout get their files written here; they are not waited for again.
- **Parallel shutdown** — send `shutdown_request` to all spawned agents in parallel (single broadcast pass). Wait up to **30s wall-clock total** (not per agent) for `shutdown_response` replies. Worst-case teardown latency is 30s regardless of team size.
- **Force-abandon path** — any agent that has not responded within the 30s wall-clock window (e.g., hung on long Bash call, MCP stuck, or already crashed) is marked `abandoned` in its verdict file and skipped. The framing-review teammates are left to be reaped automatically at session end — the abandoned subprocess does not block the next task (Step 2) when one agent refuses to exit cleanly. (Round-0 framing reviewers use distinct `-framing` names so an abandoned one — still occupying its name in the implicit session team until session end — cannot collide with Step 9's same-family Doodlestein re-spawn.) A `[layer1] teardown: <agent> abandoned after 30s` entry is appended to the Layer 1 trace for audit.

#### 1.5.5. Boundary to Step 2

Step 2 spawns a **separate set of council teammates** (the framing-review teammates have been shut down). Step 2's agent selection follows `ae:agent-selection` normal rules driven by discussion content — **Round 0 agent outcomes do NOT influence Step 2's team composition**. The framing-review team is a quality gate, not a signal for discussion team design.

**Why Round 0 exists (not a mechanism you can inline into later rounds)**: once Round 1 spawns, agents anchor on whatever framing is provided. Mid-round reviewers (challenger, Doodlestein at conclusion) evaluate within the framing. Round 0 is the only point where framing itself is the object of evaluation, before it infects Round 1 context.

### 1.6. Prior Context (project knowledge graph)

Run this step after Round 0 approves framing (Step 1.5) and before spawning the team (Step 2). Query = the approved `framing.md` problem statement. (Compact locate-step; the canonical long form incl. grep-fallback lives in analyze/SKILL.md § Prior context.)

1. Regenerate + read the layered index: run `plugins/ae/bin/graph-index-gen.py` (cheap, byte-idempotent), read `.ae/graph/index.md`. Generator fails / no feature dirs → emit `Prior context: unavailable (no knowledge index)` and continue to Step 2.
2. **[LLM]** Theme-pick: semantically read Tier A + the picked themes' TL;DRs against the query; read the survivor node pages (keep the set small — ≤10; thin/empty results → fall back to the canonical long form incl. grep-fallback in analyze/SKILL.md).
3. **[deterministic]** Traverse the survivors' edges ONE hop in a single batched `plugins/ae/bin/graph-neighbors.py <survivor-id ...>` call; read newly-reached feature targets' pages (BL/disc targets cite from the edge `evidence` alone; a survivor with no edges yields no lines — normal outcome, not an error; the ≤10 read cap covers the folded targets too).
4. Present under `## Prior Art from Project Knowledge Base` with provenance per item: `id`, `title`, how located (`theme-pick` / `edge from <id>`), edge `evidence` when edge-located.
5. Include prior art in the topic brief compiled for agents in Step 2 — treat as background context, does not constrain discussion

## Step 2. Spawn Discussion Team (once, persists until Conclusion)

**The core of ae:discuss is team discussion.** One team lives for the entire discussion — only add agents, never remove.

**DO NOT shut down teammates between topics, after scoring, or before Doodlestein.** The teammates persist from Step 2 through Doodlestein (Step 9). Original participants must be alive in case Doodlestein's review of the conclusion kicks off a new round.

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
# All agents are equal participants — dynamic roles per Agent Selection Reference.
Agent(subagent_type: "<per agent-selection>",
      name: "<role-name>", # e.g., "architect", "code-researcher", "security-expert"
      run_in_background: true,
      prompt: "📋 Cast: <runtime-selected>
                  Role: <role-name> (council participant in <discussion title>)
                  Angle: <role-specific focus per Agent Selection Reference>
                  Why: <slot rationale at TL spawn-decision time>

               You are <ROLE> in a design discussion: <discussion title>.
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

**TL is the moderator.** TL drives rounds, routes messages, highlights disagreements, identifies convergence. Per `ae:agent-teams` Discussion Mode. After exploration, TL triages points by stakes × reversibility (cut noise, merge small points) and surfaces the result in the Step 6 Steering Readout — discussion budget goes to high-weight points, not every point round-robin; not every point earns an operation.

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
- **Unanimous Agreement Gate**: when all agents agree on a topic direction, TL runs UAG per `ae:agent-teams` Discussion Mode — structured falsification question, agents must search for counterexamples. Passed UAG = genuine convergence. **The 1-round fast-track (see Principles → "Discussion before user") does NOT waive UAG**: a fast-tracked topic where all agents agree on Round 1 is exactly the groupthink case UAG exists to catch — run UAG before converging it.
- Sub-questions resolved in-team — do NOT bubble up to user
- Continue until all topics have either clear direction (UAG passed) or genuine disagreement

**TL synthesis format (mandatory 4 fields, written in each round's `round-NN/synthesis.md`)**:

1. **Pruned section** (attempt-before-record + AC-quote required for Retain — per F-026):

   BEFORE writing the synthesis, list every mechanism in the merged Round N output (where "mechanism" = a discrete rule, signal, gate, parameter, step, or assertion that the synthesis introduces or carries forward). For each mechanism, ask: "does removing this break a stated AC or a framing-section constraint?" Then record either:

   - **Pruned: [mechanism]** — reason: [which lower-tier need it served; why that need can be dropped]
   - **Retained: [mechanism]** — verbatim AC# `<num>` or framing-section clause that breaks if removed: `"<quoted text>"`. Paraphrasing is INVALID — if you cannot quote a specific clause, reclassify the mechanism as `Pruned:` with reason "no AC-anchored justification."

   The legacy `"Pruned: nothing; all inputs advanced"` shortcut is **NO LONGER VALID**. A synthesis with zero Pruned entries is acceptable ONLY if accompanied by the full per-mechanism Retained list with verbatim quotes. Missing the Retained list when zero pruned = protocol violation. Missing the verbatim quote on any Retained entry = `n_retained_without_rationale++` and synthesis-gate rejection (see below).

   **F-026 background**: prior version placed quote requirement only on `doodlestein-scope-reducer` (post-conclusion). That left per-round TL synthesis at format-only enforcement — TL could write unquoted Retained entries and the gate (counting lines only) would pass. Per-round accretion happens BEFORE scope-reducer sees it. Quote requirement now lives at the synthesis layer where it's effective; scope-reducer's quote requirement remains as a confirmatory layer at post-conclusion phase.

   **Runtime enforcement** (synthesis-gate): /ae:discuss verifies at `round-NN/synthesis.md` write time that either ≥ 1 `Pruned:` entry exists OR ≥ 1 `Retained:` entry with AC-anchored verbatim quote exists. A synthesis with zero of both is rejected with `[SYNTH-GATE] empty Pruned/Retained — rewrite required`. A Retained entry without a verbatim quote increments `n_retained_without_rationale` (which MUST stay 0 in healthy runs) and the gate also rejects. TL is forced to rewrite the synthesis section before the round closes.

   **Trace emission**: after the synthesis section is written + gate passes, /ae:discuss invokes `${CLAUDE_PLUGIN_ROOT}/scripts/append-synthesis-trace.sh` with 6 positional integer args:

   ```sh
   ${CLAUDE_PLUGIN_ROOT}/scripts/append-synthesis-trace.sh \
     <round> <n_mechanisms> <n_pruned> <n_retained_with_rationale> <n_retained_without_rationale> <n_strictly_needed_estimate>
   ```

   The helper emits one NDJSON record per round to `~/.ae/traces/${AE_SESSION_ID}.ndjson` with shape:

   ```json
   {"ts":"<ISO8601>","record_type":"synthesis-gate","skill":"ae:discuss","round":N,"n_mechanisms":...,"n_pruned":...,"n_retained_with_rationale":...,"n_retained_without_rationale":...,"n_strictly_needed_estimate":...}
   ```

   `n_strictly_needed_estimate` comes from `doodlestein-scope-reducer`'s post-conclusion denominator estimate when scope-reducer has run for this discussion; -1 when unavailable (e.g., this is a Round 1 synthesis and scope-reducer hasn't fired yet — scope-reducer is post-conclusion). The 9-field shape uses `record_type: "synthesis-gate"` as a discriminator so this per-round record can coexist with T1's per-skill-invocation 9-field record in the same `<session-id>.ndjson` stream without consumer confusion.

   Per-round bounded scope: per-mechanism list is capped at the synthesis's actual mechanism count. No minimum prune quota — some Round 1+ work genuinely adds nothing prunable. The forcing function is the WORK of attempting + the runtime gate, not the result count.
2. **Of-framing disposition**: list every of-framing challenge raised this round + TL's disposition (integrate / reject-with-reason / defer-to-followup-BL). TL fills this; do NOT rely on agent self-tagging of challenges. **When `round_0: integrated_no_rerun`**: additionally cross-check each of-framing challenge against the fast-path-integrated points — ≥2 agents re-raising an integrated point triggers the auto-revert (§1.5.3 Rule 2a: contested-path rerun + BL).
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

**REQUIRED — Steering Readout (every round, user-facing, plain language).** After the batch result above, TL MUST emit a plain-language `## Steering Readout — Round N` block so the user keeps a live correction window. Three parts, **decision-first** (TL's judgment leads — never an A/B/C options dump, never hands the decision back):
1. **Triage** (the judgment, leads): `deep-diving: <topic + one-line why> | shallow: <topic> | parked: <noise points, listed>`
2. **Status**: one line per topic
3. **Redirect?** (secondary): a correction-window CTA only — does NOT replace the judgment above

**Triage = the judgment, not decoration.** TL ranks points by **stakes × reversibility**, cuts noise, merges small points, and writes the result into the Triage line — surfacing it to the user AND driving TL's own attention budget. Not every point earns an operation.

**No silence.** The readout is mandatory every round: if there was nothing to triage, write `Triage: no triage (all points already weighted)` explicitly — never omit the block. The first readout after the exploration round MUST carry a non-empty `parked:` list when noise was cut.

**Detail scales with contention** (not all-or-nothing). The whole-readout one-line form (e.g. `Steering: all topics converging, closing Round N`) is legal ONLY when every topic is converging/simple. If any topic is being deep-dived or has an **open disagreement**, the readout MUST carry a substantive Triage entry for each such topic (**no boilerplate** like "deep-dive X because complex"); converging topics may be one line within the same readout.

Keep the readout in plain language — no internal bookkeeping terms (Round 0 / §1.5.3 / synthesis-gate / UAG / etc.) in this user-facing block.

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

## Spawned Discussions
| # | Topic | New Discussion | Reason |
|---|-------|----------------|--------|
| (only if Sweep spawned sub-discussions) |

## Deferred Resolutions
| # | Topic | Resolution | Detail |
|---|-------|------------|--------|
| (only if Sweep resolved deferred items) |

## Process Metadata
<!-- KEEP this header AND the two fields below: /ae:plan reads them as dual sentinels
     (plan/SKILL.md ~:106 requires the heading; ~:110 reads these two field VALUES).
     Deleting either the header or these fields makes /ae:plan refuse or false-warn.
     Other per-discussion counts are intentionally omitted (machine bookkeeping, not user-facing). -->
- Autonomous decisions: N
- User escalations: N

## Next Steps
→ `/ae:plan` for converged decisions
→ Resolve spawned discussions first if any

## Doodlestein Review
[Challenges raised, how each was resolved, any topics reopened — audit trail, kept below Next Steps]
```

**Conclusion prose follows [AE Output Standards](../../output-standards.md)** (same as `analyze`): lead with the single most important decision (no preamble); rationale concise and directly supporting the decision; risks explicit; rejected alternatives + round-by-round detail belong in the lower-layer audit trail, not the pyramid tip.

**Entity extraction (required)**: Before writing the conclusion, extract entities from the Decision Summary Topic column for the `entities:` frontmatter field. For each topic: produce the full compound form (kebab-case) + individual tokens. Single-word topics → one entity. Multi-word → tokens + full compound only (no partial compounds). Filter stopwords and pure numbers. Lowercase, deduplicate. Example: "Auth middleware" → `[auth, middleware, auth-middleware]`.

Update index.md: set `pipeline.discuss: done`, add conclusion link.

### 9. Doodlestein — Post-Conclusion Review

**Triggered when**: Conclusion document is written. Doodlestein reviews the **written conclusion**, not the discussion in progress. No round extensions from Doodlestein findings.

Per `ae:agent-teams` Doodlestein Protocol. Four fresh agents, each answering ONE focused question against the conclusion document.

```
Agent(subagent_type: "doodlestein-strategic", name: "doodlestein-strategic",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-strategic
                  Role: post-conclusion reviewer (strategic)
                  Angle: single smartest improvement to the conclusion
                  Why: catch alternatives that could have improved the decision

               <path to conclusion.md> — single smartest improvement?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-adversarial", name: "doodlestein-adversarial",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-adversarial
                  Role: post-conclusion reviewer (adversarial)
                  Angle: first real-use failure of the conclusion
                  Why: catch implementation cliffs before commitment

               <path to conclusion.md> — where does this first fail in real use?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-regret", name: "doodlestein-regret",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-regret
                  Role: post-conclusion reviewer (regret prediction)
                  Angle: highest-regret decision likely reversed within 6 months
                  Why: surface reversibility cost before lock-in

               <path to conclusion.md> — which decision most likely reversed in 6mo?
               Your answer is post-conclusion review, not a reopen signal.
               IMPORTANT: STAY IN THE TEAM. Do NOT exit.")

Agent(subagent_type: "doodlestein-scope-reducer", name: "doodlestein-scope-reducer",
      run_in_background: true,
      prompt: "📋 Cast: doodlestein-scope-reducer
                  Role: post-conclusion reviewer (scope reduction — SUBTRACT angle)
                  Angle: what could be deleted from the conclusion such that the original problem is still solved?
                  Why: the other 3 Doodlestein agents are all ADD-shaped by question framing (accretive / omissions / hedges); scope-reducer is the only SUBTRACT-shaped one. F-026 root cause: every existing reviewer asks an ADD-shaped question; no one asks the SUBTRACT-shaped question.

               <path to conclusion.md> — per-mechanism Delete | Defer | Retain classification.
               Retain REQUIRES verbatim AC-quoted evidence (paraphrasing reclassifies to Defer).
               Also emit final-line `Strictly_needed_count: <int>` denominator estimate.
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

## Principles

- **Discussion Mode**: TL = moderator, all agents = equal participants. No forced proposer/opposition. Positions evolve based on evidence. Per `ae:agent-teams` Discussion Mode.
- **Team explores, TL synthesizes**: The value of ae:discuss is multi-agent collaborative exploration with code evidence. If the team didn't explore it, don't present it to the user.
- **Consensus verification**: Topics with decisions get stress-tested via temporary Debate Mode (forced FOR/AGAINST) before being marked converged. Discussion finds the direction, consensus confirms it.
- **One team, one lifecycle**: Spawn once, add agents as needed, never remove. Shutdown only after Doodlestein post-conclusion review completes.
- **Strong opinions welcome**: Agents with dissenting views are assets. Genuine disagreement is valuable signal.
- **Dynamic composition**: Agent roles determined by discussion content via `ae:agent-selection`. Multiple instances of same backend with different roles encouraged.
- **Discussion before user**: pace by complexity. Simple / high-reversibility topics may converge in **1 round** (invoking the existing high-reversibility fast-track); complex topics — genuinely contested AND consequential — run the full research → explore. **A 1-round fast-track topic MUST still run the Unanimous Agreement Gate (UAG)**; only purely informational (non-decision) topics skip the explore round. Sub-questions resolved internally. Only genuine dilemmas reach the user.
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
  framing.md # problem statement + round_0 verdict (Step 1/1.5)
  index.md # minimal scaffolding
  round-00/ # Step 1.5 framing review artifacts
    codex-proxy.md # per-agent verdict (APPROVED / REVISE / unavailable + reason)
    gemini-proxy.md
    doodlestein-strategic.md
    doodlestein-adversarial.md
    minimal-change-engineer.md
    dogfood-evidence.md # optional — session evidence for protocol verification
  topic-NN-slug/
    summary.md # current state — agent reads ONLY this each round
  round-01/ # per-round directory
    <agent-name>.md # each agent's own file (self-written, TL does not edit)
    synthesis.md # TL index/orientation + 4 mandatory fields (Pruned / Of-framing disposition / Verification artifact / Frame-challenge self-check)
  round-02/
    <agent-name>.md
    synthesis.md
  conclusion.md # Step 8
  round-doodlestein/ # Step 9 post-conclusion review
    strategic.md
    adversarial.md
    regret.md
    scope-reducer.md
```

**framing.md** (written by TL in Step 1; reviewed by the framing-review team in Step 1.5):

```markdown
---
id: "NNN"
stage: framing
created: YYYY-MM-DD
round_0: pending # pending → approved | approved (cross-family-degraded) | integrated_no_rerun | revise_requested | overridden
round_0_reviewers: [] # populated by Step 1.5 after aggregation; list of reviewer names
round_0_notes: "" # human-readable rationale for override, aggregation notes — or on integrated_no_rerun: the structured three-condition record (convergent: / no_user_call: / not_structural:)
---

# Framing — [title]

## User Question (Frozen)
[User's original request / question, copied verbatim. This section is sacred:
do NOT rewrite, paraphrase, normalize, translate, narrow, broaden, or "clarify" it.
Reviewers may critique surrounding sections; this section is immutable.

See §1.4 "Writing the User Question (Frozen) section" for TL's write-time constraints
and §1.5.1 / §1.5.3 for review-time guards (Frozen-field rule + Rule 1.5 byte-diff check).]

## Problem Statement
[What needs to be solved. Describe the problem; do NOT pre-commit to solution mechanisms, list A/B/C options, or embed specific tools.]

## Scope
[What's in and out. Keep open to Round 1 exploration.]

## Reference Material
[Links to prior discussions / BLs / data that inform the problem.]
```

**summary.md** (agent reads this every round — keep concise):

```markdown
---
id: "NN"
title: "[topic title]"
status: pending # pending → converged / revisit / deferred
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

## Trace emission (final step)

Before skill exit, follow [Trace Emission Protocol](../../docs/references/trace-emission-protocol.md) — emit 9-field trace record to `~/.ae/traces/<session-id>.ndjson` (no LLM content, per-skill-invocation metadata for v0.11.x consumers).
