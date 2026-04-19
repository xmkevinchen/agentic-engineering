---
id: layer2-governance-force-broken
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
verify_first_status: PENDING
---

## Expected Behavior

> **ASSERTIONS ARE PROVISIONAL** — they encode the spec behavior. Per plan 042 Step 2 verify-first protocol, these assertions MUST be re-validated against observed runtime behavior BEFORE being trusted as a gate. See `## Observed-Runtime-At-Authoring` below.

### MUST (provisional, pending verify-first)
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

**Status: PENDING** — verify-first run not yet executed.

Per plan 042 Step 2 verify-first protocol (before committing this assertion to the test suite):

### Step 1 — Scratch Worktree Setup
```
git worktree add /tmp/layer2-verify-broken HEAD
cd /tmp/layer2-verify-broken
cp -R plugins/ae/tests/fixtures/layer2-governance/* .
```

### Step 2 — Execute with --agent-debug
```
/ae:discuss "missing-agent edge case — verify broken-force escalation path" --agent-debug
```
(Or whichever invocation form surfaces the debug trace for this repo's current /ae:discuss implementation.)

### Step 3 — Capture Trace
Save full transcript to `/tmp/layer2-verify-broken/observed-runtime.txt` including:
- Whether team spawn preceded or followed broken-rule detection
- Exact text surfaced when broken-rule was detected (or absence thereof if silent)
- Debug output mentioning Layer 1 rule evaluation
- Whether AskUserQuestion (or equivalent) fired

### Step 4 — Record Observation Here

TO BE FILLED after verify-first run — template:

```
Date: YYYY-MM-DD
Worktree HEAD: <sha>
Capture file: /tmp/layer2-verify-broken/observed-runtime.txt

Observed behavior:
- [ ] ESCALATE path fired as spec describes
- [ ] Silent fall-through to Layer 2 occurred (SPEC-RUNTIME DRIFT)
- [ ] Different path: <describe>
- [ ] Error / crash: <describe>

Match-verdict:
- [ ] Spec matches runtime → encode observed behavior as MUST assertion (flip verify_first_status to CONFIRMED)
- [ ] Spec diverges (simple fix) → file spec-runtime-drift BL, fix setup/SKILL.md + ae:agent-selection runtime wiring, re-run verify-first
- [ ] Spec diverges (fundamental) → invoke deep-drift escape hatch:
      - Scope-reduce Step 2: drop this test case from plan 042 Step 2; ship Step 2 with 2 cases (happy + prefer-stack-kill)
      - OR pause Phase 2: close plan 042 as partially-complete, file new discussion
```

### Step 5 — Cleanup
```
git worktree remove /tmp/layer2-verify-broken
```

## Deep-drift escape hatch — executor decision record

If verify-first reveals fundamental drift (not a simple fix), TL must NOT autonomously decide — escalates to user for:
1. Scope-reduce Step 2 to 2 test cases (ship without broken-force coverage; file BL for Phase 3)
2. Pause Phase 2 entirely, file new discussion for governance-chain wiring

Record decision here with user-confirmation timestamp before proceeding.
