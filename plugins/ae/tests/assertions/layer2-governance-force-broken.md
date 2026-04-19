---
id: layer2-governance-force-broken
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
verify_first_status: CONFIRMED
verify_first_date: 2026-04-19
---

## Expected Behavior

> **VERIFY-FIRST CONFIRMED 2026-04-19**: independent LLM agent (simulating a fresh CC session, full access to the fixture + spec files) traced the fixture through both `agent-governance-format.md` and `agent-selection/SKILL.md`, verified Rule 3 fires on the topic's context tokens, confirmed the referenced agent file is absent, and confirmed the spec unambiguously prescribes outcome (A) ESCALATE via AskUserQuestion. See `## Observed-Runtime-At-Authoring` for evidence.

### MUST
- [behavior] Before team spawn, AE detects broken force rule (agent file `nonexistent-rust-auditor.md` absent) and surfaces an ESCALATE prompt (AskUserQuestion-equivalent) asking user whether to continue with Layer 2 fallback, cancel, or remove the rule
- [behavior] Escalation surfaces the specific broken-rule context — identifies Rule 3 by `agent: nonexistent-rust-auditor`, shows matched context keywords, and proposes concrete next actions (e.g., "/ae:setup agents --add nonexistent-rust-auditor" OR "/ae:setup agents --rule-cleanup")
- [text:contains] Output text contains the phrase `nonexistent-rust-auditor` AND one of: `missing`, `not found`, `absent`, `broken rule`, `[ae:governance] ESCALATE`

### MUST_NOT (provisional)
- [behavior] MUST NOT silently fall through to Layer 2 without surfacing the broken rule (silent fall-through = policy violation for force rules per governance-format spec)
- [behavior] MUST NOT crash / error out ungracefully — escalation is a user-interaction, not a system error
- [team:exists] MUST NOT spawn the discussion team before user responds to the escalation prompt

### SHOULD
- [behavior] Escalation provides option to proceed with Layer 2 fallback (allowing the user to accept degraded governance for this one run)
- [behavior] Escalation provides option to cancel the skill invocation entirely
- [behavior] Escalation provides option to auto-remove the broken rule (mutation requires user confirmation)

## Observed-Runtime-At-Authoring

**Status: CONFIRMED — verify-first executed 2026-04-19.**

### Method
Spawned an independent general-purpose Claude agent with full access to this repo's main working tree (HEAD at commit 1d06578). Agent was instructed to simulate a fresh CC session at the fixture root, follow `/ae:discuss` SKILL.md + `agent-selection/SKILL.md` + `agent-governance-format.md` as literally as possible, evaluate the 4 seeded rules against the topic `"missing-agent edge case — verify broken-force escalation path"`, and report what it would DO upon encountering a fired `force` rule with a missing agent file.

Evidence artifact: agent transcript captured during session (summarized in verdict below; full agent ID `a6ecf4d466f52ddf2`).

### Observed
- **Scope resolved**: `discuss` (from `/ae:discuss` invocation)
- **Context tokens extracted from topic**: `missing`, `missing-agent`, `agent`, `edge`, `case`, `edge-case`, `verify`, `broken`, `broken-force`, `force`, `escalation`, `path`
- **Layer 1 rule evaluation**:
  - Rule 1 (`force rust-mcp-expert for [mcp, tool-auth] scope discuss`): scope match, context NO match → does not fire
  - Rule 2 (`prefer security-specialist for [security, vulnerability] scope review`): scope mismatch (active is `discuss`) → does not fire
  - Rule 3 (`force nonexistent-rust-auditor for [missing, edge-case] scope all`): scope match (`all`), context match (`missing` substring-matches `missing-agent`; `edge-case` matches `edge case`) → **FIRES**
  - Rule 4 (`prefer phpstan-expert for [security, audit] scope discuss`): scope match, context NO match → does not fire
- **Broken-rule detection**: `ls .claude/agents/` confirmed `nonexistent-rust-auditor.md` is absent. Agent correctly identified this by mapping `agent: nonexistent-rust-auditor` → filename stem → expected `.claude/agents/nonexistent-rust-auditor.md`. Cited `agent-governance-format.md:50` ("Must exist — broken references handled per 'Failure semantics' below").

### Decision traced by agent
**(A) ESCALATE via AskUserQuestion** with 3 options:
1. Continue with Layer 2 fallback (this run only; rule stays intact)
2. Remove the broken rule
3. Cancel — no team spawned

### Spec citations (verbatim from the agent)

From `agent-governance-format.md:121-130`:
> - **`action: force`** → ESCALATE via AskUserQuestion:
>   ```
>   [ae:governance] Rule 'use rust-mcp-expert for mcp/tool-auth (force)' references missing agent.
>   Options:
>   1. Continue with Layer 2 fallback (this run only; rule stays intact)
>   2. Remove the broken rule
>   3. Cancel — no team spawned
>   ```
>   `force` is a stronger user intent signal than `prefer`; silent fall-through would violate user expectations.

Corroborated at `agent-selection/SKILL.md:61-63`:
> **Broken rule (agent missing)**:
> - `prefer` → warn + fall-through to Layer 2 without boost.
> - `force` → ESCALATE via AskUserQuestion (continue with Layer 2 fallback vs. cancel vs. remove rule).

### Verdict
**Spec unambiguously describes outcome (A) ESCALATE.** Both specs converge on the same prescription with the same three user options. Two independent locations state the behavior with explicit rationale for why `force`-missing cannot be silent. No ambiguity, no silence, no alternative path. `verify_first_status` flipped from PENDING to CONFIRMED.

### P3 spec-quality note (from agent — filed for future cleanup)
The example AskUserQuestion text at `agent-governance-format.md:123` hardcodes `'use rust-mcp-expert for mcp/tool-auth (force)'` as the rule label — that's a placeholder borrowed from Rule 1's example. A runtime implementation must substitute the ACTUALLY-triggering rule (here, Rule 3: `nonexistent-rust-auditor` / `[missing, edge-case]` / `scope: all`). The template nature of the example is clear from context, but an overly-literal implementer could cargo-cult the placeholder string. Cosmetic spec gap, not a semantic one. Recommendation: re-word the example as a template (e.g., `[ae:governance] Rule '<action> <agent> for <context> (<scope>)' references missing agent.`) in a future cleanup. Filed as P3; does NOT block Phase 2 shipping.

## Deep-drift escape hatch — executor decision record

Not invoked. Verify-first confirmed spec matches observed (outcome A). Proceed with Phase 2.
