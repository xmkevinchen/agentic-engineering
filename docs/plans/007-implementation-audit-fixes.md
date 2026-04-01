---
id: "007"
title: "Implementation Audit Fixes — Discussion 008"
type: plan
created: 2026-03-31
status: done
discussion: "docs/discussions/008-implementation-audit/conclusion.md"
---

# Feature: Implementation Audit Fixes

## Goal
Implement Discussion 008's 8 converged decisions — fix auto-pass gate, improve Doodlestein, fix agent lifecycle, establish verification baseline.

## Steps

### Step 1: Fix auto-pass gate silent bypasses (AC1)

Modify `work/SKILL.md` to close two structural loopholes:

- [x] Change line 170: `No test command → tests_green treated as true` → `No test command → tests_green = UNVERIFIED — pause for user confirmation before continuing`
- [x] Change lines 128-131: `No "Expected files:" in plan → skip drift check` → `No "Expected files:" → drift = UNKNOWN — pause for user confirmation before continuing`
- [x] Update gate formula (line 164): add handling for UNVERIFIED/UNKNOWN states — these are NOT true, they block the gate. Gate formula becomes: `gate = tests_green(verified) AND no_p1 AND (no_drift(verified) OR drift_approved)`
- [x] Add note: when both conditions trigger simultaneously, gate MUST pause (not auto-pass)

Expected files: `plugins/ae/skills/work/SKILL.md`

### Step 2: Add Doodlestein role reversal + agent persistence to discuss skill (AC2, AC3)

**Must execute as single step** — both modify discuss/SKILL.md, and Step 2's new agent prompts need persistence directives.

Modify `discuss/SKILL.md` Doodlestein section (lines 295-328):

- [x] Replace "问卷模式" with role reversal:
  - Challenger becomes Attacker (sends Q1/Q2/Q3 challenges to Defender)
  - gemini-proxy becomes Defender (defends decisions with code evidence)
  - codex-proxy observes + provides cross-family perspective to Challenger for synthesis
  - Challenger synthesizes Doodlestein Report
- [x] Keep the 3 questions unchanged — only change interaction pattern

Add agent persistence to ALL spawn prompts in discuss/SKILL.md:

- [x] Add to discussion round agent prompts: "IMPORTANT: STAY IN THE TEAM. Do NOT exit. Wait for follow-up rounds."
- [x] Add to Doodlestein agent prompts: same directive
- [x] Add note: "Agents persist across rounds. For Round 2+, message existing agents — do not spawn new ones."

Expected files: `plugins/ae/skills/discuss/SKILL.md`

### Step 3: Document agent definition principles in CLAUDE.md (AC4)

- [x] Add to CLAUDE.md under a new "## Agent Definition Principles" section:
  - No duplicate content: if a concept is already in the agent definition, don't add it again with different wording
  - One-line rules: prefer `- Rule summary` over multi-paragraph explanation
  - Test after changes: any agent definition modification must be followed by running a real task to verify no regression
  - No self-check steps: don't add "verify your output" instructions — they add hesitation without enforcement

Expected files: `CLAUDE.md`

### Step 4: Document TL autonomy boundary (AC5)

- [x] Add to CLAUDE.md or discuss skill: clear statement of what TL decides autonomously vs what requires user escalation
  - TL autonomous: topic convergence (most cases), agent selection, round management, Doodlestein execution
  - User escalation: low-reversibility decisions with genuine ambiguity, domain-specific context only user has
- [x] This is T1's "具体行动项" — making the mixed positioning explicit

Expected files: `CLAUDE.md` or `plugins/ae/skills/discuss/SKILL.md`

### Step 5: Run /ae:consensus smoke test — first ever execution (AC6)

- [x] Pick a real proposal (e.g., "Should AE move discussion output outside the repo?")
- [x] Run `/ae:consensus` end-to-end
- [x] Record: did cross-examination trigger? Did mediator evaluation work? Was output file created?
- [x] If execution fails: record failure reason, symptoms, and next steps (failure is still valid data)
- [x] Document results in `docs/analyses/`
- [x] This is T3 bound to T5 — first dogfooding data point

Expected files: `docs/analyses/002-consensus-smoke-test.md`

### Step 6: Add "先运行后决策" principle + version bump (AC7)

- [x] Add to CLAUDE.md: "New skills or significant skill changes must be followed by at least one real execution before the next discussion/plan cycle"
- [x] Bump version in `plugins/ae/.claude-plugin/plugin.json` (minor bump: 0.1.2 → 0.2.0 — Discussion 008 is a significant audit with behavioral changes)
- [x] Add changelog entry
- [x] Verify README component counts

Expected files: `plugins/ae/.claude-plugin/plugin.json`, `CHANGELOG.md`, `README.md`, `CLAUDE.md`

## Acceptance Criteria

### AC1: Auto-pass Gate Reliability
`work/SKILL.md` no longer has silent bypass conditions. Both `no test command` and `no Expected files` trigger pause instead of auto-pass. Verified by: grep for "UNVERIFIED" and "UNKNOWN" in work/SKILL.md.

### AC2: Doodlestein Role Reversal
`discuss/SKILL.md` Doodlestein section uses Attacker/Defender pattern instead of independent Q1/Q2/Q3 answering. Verified by: grep for "Attacker" and "Defender" in discuss/SKILL.md.

### AC3: Agent Persistence
`discuss/SKILL.md` Agent Teams spawn instructions include "STAY IN THE TEAM" or equivalent persistence directive. Verified by: grep for persistence instruction in discuss/SKILL.md.

### AC4: Agent Definition Principles
CLAUDE.md contains agent definition principles (no duplication, one-line rules, test after changes). Verified by: grep for "Agent Definition" in CLAUDE.md.

### AC5: TL Autonomy Boundary
CLAUDE.md or discuss/SKILL.md contains explicit TL autonomous vs user escalation boundary. Verified by: grep for "autonomous" or "escalation" in the target file.

### AC6: Consensus Smoke Test
`docs/analyses/002-consensus-smoke-test.md` exists with execution results (cross-examination trigger status, output file creation status). Verified by: file exists and contains "## Results" section.

### AC7: Version Bump + Principle
`plugin.json` version is 0.2.0, CHANGELOG.md has Discussion 008 entry, CLAUDE.md contains "先运行后决策" principle. Verified by: reading all three files.
