# AE Output Standards

> Source: F-015 (2026-05-10). Single source of truth for AE plugin output standards (skills, agents, TL synthesis).
> Path resolution: from any `plugins/ae/skills/<x>/SKILL.md`, this file = `../../output-standards.md` (2 levels up to plugin root).

## Scope

**Applies to**:
- TL replies to user in session
- Agent SendMessage to TL or other agents
- Git-tracked deliverables: `feature/index.md`, `analysis.md`, `discuss/framing.md`, `discuss/round-NN/<agent>.md`, `discuss/round-NN/synthesis.md`, `discuss/conclusion.md`, `plan.md`, `review.md`

**Does NOT apply to**:
- Raw tool output (grep / ls / git log direct dumps)
- When user explicitly requests raw research material

---

## The 5 Standards

### Standard 1 — Session process output (template)

```
Line 1: <conclusion / judgment / action> — one sentence
Below: supporting evidence ≤ 3 lines
```

### Standard 2 — Session phase summary (template)

```
---
## <heading>
- <decision / progress>
- <why>
- <next step>
```

The `---` horizontal rule + heading visually separates summary from process flow. Summary is self-contained (no need to scroll up).

### Standard 3 — Document layered structure

Pyramid: top ≤ 5 lines TL;DR, lower layers as audit-trail detail. Each document type has a different pyramid tip — see *Per-document pyramid tips* table below.

### Standard 4 — Closed loop

User makes 90%+ judgments without opening lower-detail layers. File paths are audit references; the reader does not open them by default.

Self-check: *"If the reader stopped at my pyramid tip, would they know what to decide / do next?"*

### Standard 5 — Deliverable self-verify

**Before sending any deliverable** (SendMessage / git-tracked doc / TL→user reply):

1. Re-read your output once.
2. Check against this standards doc:
   - Line 1 = conclusion / judgment / action?
   - Phase summary properly delimited (`---` + heading)?
   - Document top ≤ 5 lines TL;DR?
   - Reader can grok without opening lower layers?
3. If misaligned → fix before sending. **No "I'll fix it next time."**

This is the protocol-level enforcement. Standards 1–4 describe the form; Standard 5 ensures the form is honored at deliverable boundaries.

---

## Operational action

Receiving information (agent report / research / tool output) →
**First understand + distill into a ≤ 5 line "if you only read this paragraph"** →
This paragraph goes to session (pyramid tip) + document top →
Detail goes to document lower layers, retained as audit-trail.

---

## Per-document pyramid tips

Each document type has a different pyramid tip but all follow "top ≤ 5 lines + lower layers as audit-trail detail".

| Document | Pyramid tip required content | Lower-layer audit-trail |
|---|---|---|
| `feature/index.md` | Feature scope + current stage + key decision + next step | File list + links |
| `analysis.md` | Problem + current judgment + key open questions + next step | Research notes + agent report references |
| `discuss/framing.md` | What to solve + scope + what NOT to solve | User Question Frozen + reference material |
| `discuss/round-NN/<agent>.md` | My round-N stance + change from prior round + key evidence | Detailed findings + cite lines |
| `discuss/round-NN/synthesis.md` | This round's convergence + remaining disagreement + next round focus | Per-agent one-line stance + links |
| `discuss/conclusion.md` | Final decision + rationale + risks + dissent handling + next step | Round list + rejected alternatives + Doodlestein |
| `plan.md` | What to do + step count + per-step AC + risks + dependencies | Step details + diff targets + test fixtures |
| `review.md` | Verdict (pass / fail) + must-fix + optional + follow-up actions | Reviewer findings table + severity distribution |

---

## De-jargon rules

> Source: F-037 (2026-06-03). User-facing output must read as plain language; internal bookkeeping stays internal. Enforcement is prose-discipline (same bet as F-036's Steering Readout); the falsifiable trigger lives in F-037's conclusion: within the first 3 real review/consensus outputs post-ship, the same jargon class recurring ≥2 times reopens enforcement as a named BL.

### Rule A — Internal codes must be translated

Any internal code reaching user-facing output (KL #N, P1/P2/P3, § refs, protocol names) MUST carry its plain-language meaning at first occurrence. The code itself may stay in parentheses as an audit anchor — translate, don't strip.

- ✅ `Substitution warning: step 3 claimed a multi-track code review that did not run (internal code KL #1)`
- ❌ `KL #1 substitution finding [ELEVATED]`

### Rule B — Silent skips must be announced

An automatic skip that suppresses **promised coverage, findings, or review ceremony** (P2-style auto-skip, P3 auto-skip, ceremony exemptions, reviewer downscoping) MUST be announced to the user in one sentence — e.g. `Skipped 3 style/naming findings (minor; fix optional).` A skip the user never hears about closes their correction window. Internal no-op paths (missing optional files, empty-state fast paths) are NOT skips in this sense — announcing those would violate Standards 1-4's conciseness.

### Rule C — Conclusions are judgments, not process records

Conclusion/verdict documents MUST_NOT contain process-machine fields. Negative list: `ROUND_DECISION` / `Mediator Evaluation` / mode state-machine labels / per-round count tables.

- ❌ `### Mode: adaptive — ROUND_DECISION: SYNTHESIZE (2/3 majority)`
- ✅ `**Recommend**: Proceed — the migration risk is bounded and reversible. <2-3 sentence rationale + key risks>` then supporting arguments as bullets below.

Positive shape (aligned with the conclusion pyramid tip above): open with the judgment + concise rationale + key risks **in the tip**; supporting arguments and dissent handling as bullets below. The reader gets a decision, not a transcript.

**Exemption**: TRUE SENTINEL fields that downstream skills parse (e.g. the conclusion `## Process Metadata` header + its two fields, read by `/ae:plan`) stay — Rule D governs them, not Rule C. De-jargon never deletes a load-bearing field.

### Rule D — Sentinel four-tier taxonomy

Before changing ANY output string, classify it (first match wins; ordered most-restrictive-first so a string matching multiple tiers gets the safer class):

1. Production code/script parses the exact string → **TRUE SENTINEL** — never rename (e.g. `Actual files:` read by work's Check 2; Outcome Statistics field labels parsed by plugin-stats).
2. A human-audit procedure documented in-repo cites the string → **QUASI-SENTINEL** — default leave untouched (e.g. `[AE-REVIEW]` argument-inference traces: the enforcement is a human audit greping the transcript).
3. An L1 test fixture literally asserts the string → **FIXTURE-LOCKED** — may change, fixture updates in the same commit (e.g. `[frontmatter]`/`[inferred]` provenance tags).
4. Otherwise → **PURE JARGON** — rewrite freely (e.g. `ROUND_DECISION` in a verdict template, an unexplained `KL #1`).

Hybrid special case — codes whose *values* are machine-read but whose *display* is human-facing (P1/P2/P3: gate expressions and disposition rules read the code value): keep the code, add the plain meaning at first display — `P1 (blocker — security/data/crash)`. Translate the label, never change the value.

---

## Violation examples

- Session reply Line 1 is preamble, not core
- After agent team runs, paste raw 5 messages and let user read all
- List A / B / C options to user, push judgment back
- Document has no TL;DR; each reviewer gets a separate flat section
- Document trailer with "did not do X because overkill" / selection trace / meta-reflection mixed with main content
- Session prompts user to "go look at X.md" before they can decide

---

## Status

Shipped via F-015 (2026-05-10). Adoption strategy: deliver standards via inline reference in `ae:work` + `ae:review` (full inline block) and `ae:plan` + `ae:discuss` (1-line pointer). `ae:analyze` already contains an inline reference at `skills/analyze/SKILL.md:269`. Other 18 skills follow a dogfood-driven Phase 2 expansion.

Standard 5 (self-verify) is the primary enforcement mechanism. No external drift fixture (byte-compare prose is brittle). No external LLM judge (third-party LLM judging another LLM adds noise without certainty). The path is short: standards in agent context → agent / TL re-read deliverable → fix or ship.
