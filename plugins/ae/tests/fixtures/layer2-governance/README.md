# Layer-2 Governance Fixture

Fixture for Plan 042 Step 2 — BL-005 Phase 2 Rule 4 runtime verification.

## Layout

```
layer2-governance/
├── CLAUDE.md                                # @include points at agent-governance.md
├── pipeline.yml                             # tech_stack: [rust, mcp]; no agent_libraries
├── README.md                                # this file
└── .claude/
    ├── agent-governance.md                  # 4 seeded rules (see below)
    └── agents/
        ├── rust-mcp-expert.md               # domain-expert, stack: rust+mcp
        ├── security-specialist.md           # reviewer, stack-agnostic
        └── phpstan-expert.md                # reviewer, stack: php+laravel (mismatch for fixture project)
```

## Seeded Governance Rules

| # | Rule | Agent | Action | Scope | Context | Purpose |
|---|------|-------|--------|-------|---------|---------|
| 1 | force+match | `rust-mcp-expert` | force | discuss | mcp, tool-auth | Happy-path force test — forced agent should spawn |
| 2 | prefer+match | `security-specialist` | prefer | review | security, vulnerability | Prefer-boost test (not exercised in test cases; reserved for future coverage) |
| 3 | broken-force | `nonexistent-rust-auditor` | force | all | missing, edge-case | Force rule references agent file that does NOT exist → expected ESCALATE via AskUserQuestion |
| 4 | prefer+stack-kill | `phpstan-expert` | prefer | discuss | security, audit | Prefer-matching agent whose stack mismatches project stack → expected SUPPRESSED despite +0.20 bonus (strong-stack-mismatch kill wins) |

## Test Cases (in `plugins/ae/tests/prompts/`)

1. **layer2-governance-force-happy** — `/ae:discuss "MCP tool-auth design"` should include `rust-mcp-expert` in spawned team via Rule 1.
2. **layer2-governance-force-broken** — `/ae:discuss "missing-agent edge case"` should ESCALATE via AskUserQuestion because Rule 3's `nonexistent-rust-auditor` is absent.
3. **layer2-governance-prefer-stack-kill** — `/ae:discuss "security audit of Rust module"` should NOT include `phpstan-expert` in team despite Rule 4's prefer-boost (strong-stack-mismatch-kill overrides).

## Assertions

`plugins/ae/tests/assertions/layer2-governance-*.md` — blind-protocol split per ae:test-plugin. Each assertion file uses a mix of:
- `[team:exists]` mechanical checks for agent presence/absence in team config
- `[behavior]` LLM-judge checks for debug-trace semantic content (suppression reason, layer annotation, ESCALATE path)

## Verify-first Protocol (force-broken case)

Per plan 042 Step 2: before encoding the assertion for `layer2-governance-force-broken`, the runtime behavior of the ESCALATE path MUST be observed in a scratch worktree. See the assertion file's `## Observed-Runtime-At-Authoring` section for the captured evidence. If runtime fundamentally mismatches spec, the assertion file's deep-drift note will document scope-reduce or plan-pause decision.
