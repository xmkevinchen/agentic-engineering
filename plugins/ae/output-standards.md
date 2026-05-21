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

## Violation examples

- Session reply Line 1 is preamble, not core
- After agent team runs, paste raw 5 messages and let user read all
- List A / B / C options to user, push judgment back
- Document has no TL;DR; each reviewer gets a separate flat section
- Document trailer with "did not do X because overkill" / selection trace / meta-reflection mixed with main content
- Session prompts user to "go look at X.md" before they can decide

---

## Status

Shipped via F-015 (2026-05-10). Adoption strategy: deliver standards via inline reference in `ae:work` + `ae:review` (full inline block) and `ae:plan` + `ae:discuss` (1-line pointer). `ae:analyze` already contains an inline reference at `skills/analyze/SKILL.md:236`. Other 18 skills follow a dogfood-driven Phase 2 expansion.

Standard 5 (self-verify) is the primary enforcement mechanism. No external drift fixture (byte-compare prose is brittle). No external LLM judge (third-party LLM judging another LLM adds noise without certainty). The path is short: standards in agent context → agent / TL re-read deliverable → fix or ship.
