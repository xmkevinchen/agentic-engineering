---
id: layer2-governance-force-broken
target: ae:discuss
layer: 2
source: manual
fixture: plugins/ae/tests/fixtures/layer2-governance/
---

## Context

Run inside the fixture project. Fixture has:
- `.claude/agent-governance.md` Rule 3: `force nonexistent-rust-auditor for context [missing, edge-case] in scope all`
- `.claude/agents/nonexistent-rust-auditor.md` does NOT exist (deliberately absent to trigger broken-force path)

Per governance-format spec (agent-governance-format.md Failure semantics): `action: force` + agent missing → ESCALATE via AskUserQuestion asking user whether to continue with Layer 2 fallback, cancel, or remove the broken rule.

## Prompt

```
/ae:discuss "missing-agent edge case — verify broken-force escalation path"
```

Expected: before spawning the team, AE detects the broken force rule (context keywords "missing" + "edge-case" match Rule 3; referenced agent file absent) and presents an AskUserQuestion prompt. Team spawn does NOT proceed without user decision.

## Verify-first run context

This test's assertion was authored AFTER a manual verify-first run (see `assertions/layer2-governance-force-broken.md` § `## Observed-Runtime-At-Authoring`). If observed runtime diverged from spec during verify-first, the assertion encodes the observed behavior, NOT the spec, and a separate BL/discussion documents the drift.
