# AE Prompt Patterns Reference

> **Status: current, with one pattern withdrawn.** This describes the prompt
> structure AE's own agents under `plugins/ae/agents/` are actually written in.
> It is **not runtime-loaded** — agent prompts are self-contained at spawn time —
> so it is a consistency reference for whoever edits those files, and nothing
> reads it at runtime.
>
> Two cautions before you build on it:
>
> - **The Vibe pattern is withdrawn.** The field it prescribes was measured to
>   reach nothing (see below). It is still set on 13 definitions and queued for
>   removal.
> - **These definitions are queued for an overhaul.** Several still carry
>   sections written against a coordination layer that has changed underneath
>   them. Match the surrounding file when making a small edit; do not treat the
>   patterns here as a reason to keep a section a rewrite would drop.

**Audience**: whoever writes or modifies a file under `plugins/ae/agents/`.

**Origin**: extracted from an external agent collection and adapted; the
comparisons below quote that collection by path (`../agency-agents/…`), which is
not part of this repository.

## Maintenance

The patterns exist in dual form: described here, and embedded in the agent
prompts themselves. **Drift is the normal state, not an anomaly** — the prompt is
what runs, so when the two disagree, the prompt is right and this file is behind.
Update this file when you change a pattern's shape across several agents; do not
update several agents to match this file.

## Patterns

### Pattern: Identity & Memory

**Form**: `## 🧠 Your Identity` block with 4 anchor lines defining who the agent is, before any task instruction.

**agency-agents example** (`../agency-agents/engineering/engineering-code-reviewer.md`):

```markdown
## 🧠 Your Identity & Memory
- **Role**: Code review and quality assurance specialist
- **Personality**: Constructive, thorough, educational, respectful
- **Memory**: You remember common anti-patterns, security pitfalls, and review techniques that improve code quality
- **Experience**: You've reviewed thousands of PRs and know that the best reviews teach, not just criticize
```

**AE-adapted version**: drop "Memory: I remember…" (fake-memory anti-pattern, see below); use 4 anchors (Role / Disposition / What you've seen / What you don't do):

```markdown
## 🧠 Your Identity
- **Role**: Security review specialist for AE pipeline output
- **Disposition**: Adversarial about untrusted input boundaries, defensive about secrets
- **What you've seen**: SQL injection via untyped query builders, JWT secrets in repos, auth checks passing empty tokens
- **What you don't do**: Style nits, naming preferences, performance speculation
```

**Why it matters**: agent knows who it is and what it's NOT for; helps it stay in scope under unfamiliar input.

---

### Pattern: Vibe — **withdrawn**

**Form was**: a frontmatter `vibe:` field, 8–15 words, setting tone before the
body is read.

**Why it is withdrawn.** Measured 2026-08-31: `vibe:` appears in no published
list of supported frontmatter fields, nothing in this repository reads it, and a
seat spawned from a fresh session and asked to report its own context verbatim
had **no line beginning `vibe:` anywhere in it**. It reaches nothing. Two
neighbouring fields failed the same way and have already been removed —
`omitClaudeMd` (not a supported field) and `skills` (delivered only the one-line
description every skill gets anyway).

It is still set on **13 of 18** definitions. Each holds one sentence of real
intent, so the removal is a rewrite of where that sentence lives, not a deletion
of thirteen lines — which is why it is queued rather than done.

**What to do instead**: if the disposition matters, write it into the body,
where the agent will actually read it.

---

### Pattern: Critical Rules

**Form**: `## 🚨 Critical Rules` numbered block with absolute constraints (not soft suggestions).

**agency-agents example** (`../agency-agents/engineering/engineering-code-reviewer.md`):

```markdown
## 🔧 Critical Rules
1. **Be specific** — "This could cause an SQL injection on line 42" not "security issue"
2. **Explain why** — Don't just say what to change, explain the reasoning
3. **Suggest, don't demand** — "Consider using X because Y" not "Change this to X"
4. **Prioritize** — Mark issues as 🔴 blocker, 🟡 suggestion, 💭 nit
5. **Praise good code** — Call out clever solutions and clean patterns
6. **One review, complete feedback** — Don't drip-feed comments across rounds
```

**AE-adapted version** (`archaeologist.md`, scope-anchored):

```markdown
## 🚨 Critical Rules
1. **State facts only** — file:line + what you found. No "this might be" speculation.
2. **No prescriptive judgment** — you're archaeology, not architecture. Don't propose fixes.
3. **Cite or skip** — every claim must have a file:line reference. No claim → don't write it.
4. **Stop at scope edge** — only investigate what's in the spawn prompt. Don't expand to "while I'm here".
5. **Don't synthesize across teammates** — TL synthesizes. You report your own findings.
```

**Why it matters**: hard constraints in numbered form are easier to honor than soft prose; absent these, agents drift toward soft preferences under pressure.

---

### Pattern: Decision Matrix

**Form**: `Pattern × Use When × Avoid When` table; gives agent a reach-for lookup tool when facing similar-looking choices.

**agency-agents example** (`../agency-agents/engineering/engineering-software-architect.md`):

```markdown
| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Modular monolith | Small team, unclear boundaries | Independent scaling needed |
| Microservices | Clear domains, team autonomy | Small team, early-stage product |
| Event-driven | Loose coupling, async workflows | Strong consistency required |
| CQRS | Read/write asymmetry, complex queries | Simple CRUD domains |
```

**AE-adapted version** (`architect.md`, decomposition strategy):

```markdown
## Decomposition Strategy Reference

| Strategy | Use When | Avoid When |
|---|---|---|
| Sequential steps | Steps share data flow / each depends on prior outcome | Steps touch disjoint file domains |
| Parallel groups | File domains non-overlapping AND shared types pre-defined | Hidden runtime deps not yet mapped |
| Foundation step first | Multiple downstream steps need shared types / DB migration / API contract | All steps are independent surface changes |
| TDD red-green per step | Logic step (any branching / state change) | Pure config / cosmetic / file move |
| Single commit step | < ~200 lines AND single concern | Multi-concern (split before plan) |
```

**Why it matters**: without a decision matrix, agent invents its own selection criteria under pressure; with one, the agent has a stable reach-for tool. Apply to agents that face recurring "which X for situation Y" choices.

---

### Pattern: ADR Template (lite)

**Form**: 4-section decision record — Status / Context / Decision / Consequences. No filler-template boilerplate.

**agency-agents example** (`../agency-agents/engineering/engineering-software-architect.md`, full version):

```markdown
# ADR-NNN: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXX

## Context
What is the issue motivating this decision?

## Decision
What is the change we're proposing/doing?

## Consequences
What becomes easier or harder?
```

**AE-adapted version** (`architect.md`, plan-local lite version):

```markdown
## ADR Output (when plan contains architectural decision)

When a step changes module boundary / external API / data contract / cross-cutting concern,
emit an ADR alongside the step:

```
ADR-<plan-id>-<NNN>: <decision title>

Status: Accepted (this plan)
Context: <2-3 lines — what forced this decision>
Decision: <what we're doing>
Consequences: + <what's easier> / − <what's harder> / future <reversal cost>
```

No need for "ADR-001 … ADR-XXX numbering" ceremony; a plan-local number is sufficient.
```

**Why it matters**: decision records anchor "why" so future readers can challenge or extend the decision without rediscovering the reasoning. Lite version avoids ceremony while preserving the essential 4 fields.

---

### Pattern: Worked Examples

**Form**: `**Bad:** ❌ ... **Good:** ✅ ...` paired examples. Concrete input → output transformation showing what good output looks like vs what bad output looks like. Emoji is decorative; text label carries meaning (per codex F-016 review: emoji-only labels are unreliable for agent self-instruction).

**agency-agents example** (`../agency-agents/engineering/engineering-code-reviewer.md`):

```markdown
🔴 **Security: SQL Injection Risk**
Line 42: User input is interpolated directly into the query.

**Why:** An attacker could inject `'; DROP TABLE users; --` as the name parameter.

**Suggestion:**
- Use parameterized queries: `db.query('SELECT * FROM users WHERE name = $1', [name])`
```

**AE-adapted version** (`security-reviewer.md`, paired good vs bad):

```markdown
## Worked Examples

### Bad — vague finding
> ❌ "There's a security issue in auth flow"

### Good — specific finding (AE format)
> ✅ **P1 / `auth/handler.ts:87`** — SQL injection via untyped query builder
>
> **Why it matters**: User-supplied `email` is concatenated into raw query at line 87.
> Attacker can inject `' OR 1=1--` to bypass auth.
>
> **Suggestion**: Use parameterized query — `db.prepare('SELECT * FROM users WHERE email = ?').run(email)`

---

### Bad — out-of-scope finding
> ❌ "Also the variable naming in this file could be improved"

### Good — stay in security domain
> ✅ [Security review only — naming is out of scope. Surface to code-reviewer if needed.]
```

**Why it matters**: agents need exemplars to generalize from. Without worked examples, agent applies a vague mental model; with them, it has a concrete pattern to mirror. Pair every Bad with a Good — never just Good (no contrast = no learning signal).

---

### Pattern: Severity + Rationale + Nit Cap

**Form**: reviewer output table has THREE structural elements: `Severity` column (P1/P2/P3 enum) + `Why it matters` (Rationale) column + agent-level nit cap statement (e.g., "at most 5 P3 findings; report count if more").

**Why the three elements together**: whoever receives the findings decides what
needs a person and what does not. Without per-finding severity that triage cannot
be precise; without the rationale it cannot separate a style objection from a
logic defect at the same severity. The pattern is the agent-side prerequisite for
any triage rule at all — including the disposition requirement every AE stage
carries, that a finding ends fixed, rejected with a reason, or deferred with a
named condition.

**AE-adapted version** (reviewer output table format):

```markdown
| Severity | File | Line | Issue | Why it matters | Suggestion |
|---|---|---|---|---|---|
| P1 | auth.ts | 87 | SQL injection via raw query | Attacker can bypass auth via `' OR 1=1--`; data exfil risk | Use parameterized query |
| P2 | utils.ts | 23 | Inconsistent error handling | Diverges from codebase convention; future bugs hide here | Wrap in `Result<T, E>` per pattern in `lib/result.ts` |
| P3 | helper.ts | 5 | Variable name `tmp` not descriptive | Reader confusion in 6 months | Rename to `parsedToken` |

**Nit cap**: at most 5 P3 findings per review. If more, report count: "12 P3 findings (5 listed; suppressed for signal)".
```

**Why it matters**: precise judgment is a capability primitive. "Found an issue" without severity is noise; "found a P1 SQL injection because user input concat into raw query" is signal that TL can act on without re-reading the diff.

**Apply to**: 5 reviewer agents (code-reviewer / security-reviewer / performance-reviewer / architecture-reviewer / qa).

---

## Anti-patterns — do not copy

These appear in agency-agents but should NOT be carried into AE.

### Anti-pattern 1: Fake memory

**Anti-example** (`../agency-agents/engineering/engineering-senior-developer.md` and similar):

```markdown
## 🧠 Your Identity & Memory
- **Memory**: You remember every premium pattern that worked, every animation that felt smooth, every Three.js integration that wowed clients
```

**Why not to copy**: agents don't persist memory across spawns. Declarative "I remember…" prose is misleading — it implies state that doesn't exist. AE convention: replace with "What you've seen" (factual experience anchor) and "What you don't do" (scope boundary), both of which are stable across spawns because they're prompt content, not state.

---

### Anti-pattern 2: Emoji-heavy prose output

**Anti-example** (some agency reviewer agents):

```markdown
🔴 OMG this is a critical issue!! 🚨 The auth code 💥 has a vulnerability 😱 because...
```

**Why not to copy**: emoji-heavy prose is unparseable by downstream consumers (agent-to-agent SendMessage, TL triage logic, Track 4 staging file frontmatter). AE uses structured table + severity column; emoji is decorative ONLY in worked examples (and even there, paired with text label per Worked Examples pattern above).

---

### Anti-pattern 3: External file references

**Anti-example** (`../agency-agents/engineering/engineering-rapid-prototyper.md` and similar):

```markdown
Reference `ai/system/component-library.md` for component index
Use `ai/system/premium-style-guide.md` for luxury patterns
```

**Why not to copy**: hardcodes assumptions about external file existence. AE is project-agnostic — agents read CLAUDE.md (per-project) and the spawn prompt; no other file references should be hardcoded into agent body. If an agent needs supplemental context, the spawning skill should pass it as part of the spawn prompt, not assume agent knows where to look.

---

### Anti-pattern 4: Bloat workflow

**Anti-example** (`../agency-agents/engineering/engineering-database-optimizer.md` with 80-line SQL examples; `../agency-agents/engineering/engineering-voice-ai-integration-engineer.md` at 26KB):

Long inline code examples for specific frameworks / domains that bloat agent prompt past 200 lines.

**Why not to copy**: AE convention caps agent prompts at ~100 lines (per `CLAUDE.md` § Agent Definition Principles: "Size awareness — if an agent definition exceeds ~100 lines, review for bloat"). Past this threshold reviewer reliability degrades and spawn-time context budget is wasted; specific token thresholds are tool-dependent and not worth pinning. Domain-specific examples go in 1-2 worked examples per domain (per Worked Examples pattern). For deep domain coverage, add a separate domain-specific agent (e.g., a future `ios-expert.md`), don't bloat existing generic agents.

---

### Anti-pattern 5: Over-specified tools list

**Anti-example** (many agency engineering agents):

```markdown
You have access to: gh CLI, git, npm, yarn, pnpm, brew, asdf, nvm, docker, kubectl, helm, ...
```

**Why not to copy**: hardcoding 10+ specific CLI commands locks agent into one environment. AE convention: `tools:` frontmatter (Read / Grep / Glob / Bash) is the contract; specific CLI choice is delegated to the CC tool layer at runtime. Agent prompt may suggest tool category ("use a JSON parser") but should not name specific binaries.

---

## Quick Reference: which patterns each surviving agent carries

Read as a description of the tree as it stands, not as a prescription for a new
agent. `—` means the pattern is absent, which is often deliberate.

| Agent | Identity | Critical Rules | Decision matrix | ADR | Worked examples | Severity + rationale + nit cap |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `archaeologist` · `standards-expert` · `dependency-analyst` | ✓ | ✓ | — | — | ✓ | — |
| `code-reviewer` · `security-reviewer` · `performance-reviewer` | ✓ | — | — | — | ✓ | ✓ |
| `architecture-reviewer` | ✓ | — | ✓ (`Angle / Look For / Skip When`) | — | ✓ | ✓ |
| `architect` | ✓ | ✓ | — | ✓ | ✓ | — |
| `qa` | ✓ | ✓ | — | — | ✓ | ✓ |
| `minimal-change-engineer` | ✓ *(see below)* | ✓ | — | — | ✓ (❌/✅ pairs) | — |
| `doodlestein-scope-reducer` | ✓ | — | — | — | — | — |
| `discuss-seat` · the other three `doodlestein-*` · the three proxies | — | — | — | — | — | — |

**`minimal-change-engineer`'s identity block is the anti-pattern.** Its `## 🧠 Your
Identity & Memory` and `## 🔄 Learning & Memory` sections are Anti-pattern 1
above, verbatim — "**Memory**: You remember every bug introduced by an 'innocent'
refactor". That file is vendored body-verbatim on purpose, so the ✓ records what
is there, not what to copy. Do not use it as the model for a new agent.

The `Vibe` column was here and is gone; see the withdrawal above.
