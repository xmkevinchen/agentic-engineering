# AE Prompt Patterns Reference

Canonical prompt-writing patterns for AE builtin agents — extracted from agency-agents (`../agency-agents/`) and adapted to AE operational style. This is a **human-facing consistency reference** for agent authors and reviewers; it is NOT runtime-binding (LLMs do not load this file at spawn time).

**Audience**: agent authors writing or modifying files under `plugins/ae/agents/`; reviewers checking F-016 capability injection.

**Scope**: 7 patterns (capability primitives) + 5 anti-patterns (don't copy) + maintenance discipline.

## Maintenance Note

This reference exists in dual form: the canonical patterns described here AND embedded copies in 13 agent prompts. **Drift risk is real**: when an agent prompt updates a pattern's structure (e.g., changes Identity block from 4 anchors to 5), this reference may not be updated synchronously. Audit checklist before publishing pattern changes:

1. Update this reference first (single source for cross-agent consistency).
2. Update each agent prompt that embeds the pattern (the 13 affected agents are enumerated row-by-row in the Quick Reference table at the end of this doc; rows marked "already has" / "intentional minimal" are excluded from the 13-count).
3. Note any deviation in agent's own prompt (e.g., "Identity block uses 5 anchors instead of 4 because [reason]").

This reference is **not runtime-loaded**. Agent prompts must remain self-contained for spawn-time use. Treat divergence between this doc and agent prompts as tech debt to track, not as a runtime correctness issue.

---

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

### Pattern: Vibe

**Form**: frontmatter `vibe:` field, 8-15 words, character anchor that sets tone before body is read.

**agency-agents example** (`../agency-agents/engineering/engineering-code-reviewer.md`):

```yaml
vibe: Reviews code like a mentor, not a gatekeeper. Every comment teaches something.
```

**AE-adapted version** (4 reviewers, distinct tone per domain):

```yaml
# security-reviewer.md
vibe: Trust nothing. Verify boundaries. Name the threat model.

# performance-reviewer.md
vibe: Measure first, optimize second. Big-O over micro-tweaks.

# architecture-reviewer.md
vibe: Modules with reason. Coupling with intent. Reversibility wins.

# architect.md
vibe: Trade-offs over best practices. Name what you're giving up.
```

**Why it matters**: one-line tone anchor in frontmatter sets disposition before body is read; cheaper than a paragraph of personality prose.

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

**Trigger**: CLAUDE.md `## TL Autonomy Boundary` defines auto-skip rules:
- "**P3 auto-skip** — P3 findings in code review: skip without asking user"
- "**P2-style auto-skip** — P2 style/naming findings: skip without asking user"
- "**Review findings triage** — only P1 and P2-logic/security require user disposition"

These rules are TL-level and **assume reviewer agents emit per-finding priority + rationale**. Without per-finding severity, TL cannot precisely auto-skip; without rationale, TL cannot distinguish P2-style from P2-logic. This pattern is the agent-side prerequisite for TL Autonomy auto-skip to actually work.

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

## Quick Reference: Which patterns for which agent type

> **"extend existing"** in the cells below = build on the agent's pre-existing section rather than overwriting; preserve domain-specific entries at higher priority than the generic patterns documented in this reference. For agents not yet carrying that section, add the generic pattern as the baseline.

| Agent type | Identity | Vibe | Critical Rules | Decision matrix | ADR template | Worked examples | Severity+Rationale+nit cap |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Research (archaeologist / standards-expert / dependency-analyst) | ✓ | ✓ | ✓ | — | — | ✓ | — |
| Reviewer (code / security / performance / architecture / qa) | ✓ | ✓ | extend existing | architecture only | architecture optional | ✓ (× 2 for security/perf) | ✓ |
| Architect | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Cross-family proxy (codex / gemini) | ✓ | ✓ | extend existing | — | — | ✓ | — |
| Workflow (challenger / qa / test-lead) | ✓ (test-lead only) | ✓ | extend existing | — | — | ✓ | qa only |
| Doodlestein (× 3) | — (intentional minimal) | — | already has | — | — | — | — |
| minimal-change-engineer (vendored) | already has | already has | already has | — | — | already has | — |
