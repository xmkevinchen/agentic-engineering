---
id: "005"
title: "Adaptive Mediator Consensus Enhancement"
type: plan
created: 2026-03-31
status: done
discussion: "docs/discussions/006-consensus-enhancement/conclusion.md"
---

# Feature: Adaptive Mediator Consensus Enhancement

## Goal
Upgrade `/ae:consensus` so the mediator dynamically decides debate depth based on qualitative Round 1 signals, replacing 3 separate features (anti-groupthink, lightweight modes, cross-examination) with one unified mechanism.

## Plan Review Summary

Reviewed by: architect, dependency-analyst, simplicity-reviewer, codex-proxy, gemini-proxy.

Changes from draft:
1. **Steps 1-5 merged to 3 functional slices** — all modify SKILL.md, no independent intermediate state
2. **Numeric thresholds → qualitative yes/no questions** — LLM can't reliably count contradictions or self-report confidence; yes/no judgment is within capability
3. **Structured output required** — advocate/critic must use fixed schema (CLAIMS/EVIDENCE/UNADDRESSED/CONCEDED), mediator outputs structured ROUND_DECISION
4. **Mediator prompt split into Phase 1 (evaluate) and Phase 2 (synthesize)** — avoids context competition
5. **AC4 changed to behavioral criterion** — "3 agents, no cross-family" instead of "50-70% token savings"
6. **Max 3 rounds cap added** — prevents infinite loop on ambiguous topics

## Steps

### Step 1: Multi-round flow structure + cross-examination (AC1, AC3) — 9465e3d
- [x] Rewrite consensus flow: Round 1 (independent) → mediator evaluation → conditional Round 2 (cross-examination) → Final synthesis
- [x] Define structured output schema for advocate and critic Round 1
- [x] Define Round 2 (cross-examination) structure: mediator distributes opponent's Claims to each side; each must respond per-claim (agree/partially agree/disagree + rationale)
- [x] Add max round cap: 3 rounds maximum, mediator must synthesize after Round 3 regardless
- [x] Update argument-hint to show `--quick` and `--full` options

Expected files: `plugins/ae/skills/consensus/SKILL.md`

### Step 2: Mediator adaptive evaluation + mode flags (AC1, AC2) — 9465e3d
- [x] Define mediator Phase 1 (evaluation) — structured YES/NO evaluation block
- [x] Decision rules: adaptive/quick/full routing
- [x] Define mediator Phase 2 (synthesis) — clearly separated from Phase 1 in prompt
- [x] Parse `$ARGUMENTS` for `--quick` and `--full` flags; `--quick` creates team with 3 agents only

Expected files: `plugins/ae/skills/consensus/SKILL.md`

### Step 3: Verdict format + output (AC2, AC3) — 9465e3d
- [x] Verdict includes: mode used (adaptive/quick/full), mediator evaluation block, cross-examination exchange summary (if occurred)
- [x] If adaptive skipped cross-exam, include mediator evaluation showing why
- [x] Update persist step: verdict file includes mode + evaluation
- [x] If cross-examination occurred, verdict includes per-claim response summary

Expected files: `plugins/ae/skills/consensus/SKILL.md`

### Step 4: Version bump and changelog (AC4)
- [x] Bump version in `plugins/ae/.claude-plugin/plugin.json` (0.1.0 → 0.2.0)
- [x] Add changelog entry describing adaptive mediator enhancement
- [x] Verify README component counts (14 skills, 13 agents, 2 MCP — unchanged)

Expected files: `plugins/ae/.claude-plugin/plugin.json`, `CHANGELOG.md`, `README.md`

## Acceptance Criteria

### AC1: Adaptive Flow — mediator correctly routes based on qualitative signals
Run `/ae:consensus` on a clear-cut proposal. Mediator evaluation block must appear with YES/NO answers and ROUND_DECISION. When no unaddressed arguments and no active disagreement → cross-examination skipped.

### AC2: Mode Override — --quick and --full flags work
- `/ae:consensus --quick "proposal"` → 3 agents only, no cross-family, no cross-examination, mediator skips evaluation
- `/ae:consensus --full "proposal"` → full flow with cross-examination regardless
- `/ae:consensus "proposal"` → adaptive (mediator decides)

### AC3: Cross-examination Quality — structured engagement
When cross-examination is triggered, advocate and critic Round 2 output must respond per-claim to opponent's Round 1 Claims section. Verdict includes exchange summary.

### AC4: Versioning — all version artifacts updated
plugin.json version bumped, CHANGELOG.md has entry, README.md component counts accurate.
