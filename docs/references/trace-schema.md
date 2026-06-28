# AE trace schema

Two distinct trace records live under `~/.ae/traces/<session-id>.ndjson` and (for review lens selection) in the review's own selection-trace emission. They are separate concerns; do not conflate them.

## 1. Session trace (T1, `write-trace.sh`) — schema v1.2, 9 fields

One record per skill invocation, emitted by each skill's final-step `write-trace.sh` call. Fields: `timestamp`, `project_root`, `skill`, `feature_id`, `diff_paths`, `families_invoked`, `verdicts`, `outcome`, `session_id_source`. Producer = SKILL.md final emission step; graceful (missing inputs → warn + exit 0, non-blocking). This is per-invocation session telemetry — NOT lens-selection state.

## 2. Review lens-selection trace (F-067) — selection provenance

Emitted by `/ae:review` § 0 (Deterministic risk-floor + selection trace) per review invocation, alongside the Layer 1/Layer 2 selection trace. Records **which path produced each review lens**, so an audit can distinguish a deterministically-forced lens from an LLM-added one — not merely that a lens appeared. Four fields:

| field | source | determinism |
|---|---|---|
| `baseline_lenses` | the always-on structural floor (challenger + code-reviewer) created unconditionally by `/ae:review` §1/§2 | deterministic (structural, not LLM-chosen) |
| `risk_floor_lenses` | output of `plugins/ae/scripts/risk-floor-lenses.sh` (diff paths × `work.security_patterns` globs) | deterministic **given the current globs** |
| `soft_added_lenses` | specialist lenses the LLM ADDED on positive diff evidence (`/ae:review` §3 sparse-fill) | LLM-judged (soft signal) |
| `final_lenses` | `union(baseline_lenses, risk_floor_lenses, soft_added_lenses)` | derived |

**Invariants** (the F-067 safety contract):
- `final_lenses ⊇ baseline_lenses` always (never-drop — the floor is structural; AC2).
- `final_lenses ⊇ risk_floor_lenses` always (the soft-add can ADD beyond the floor, never remove a floor-forced lens; AC4).
- A lens in `risk_floor_lenses` was forced deterministically — its presence does NOT depend on, and cannot be vetoed by, the LLM soft-add.

**Honesty scope** (F-067 Doodlestein): the trace **records** the selection; it does not **prove** the soft-add judged correctly. `risk_floor_lenses` is deterministic only insofar as `work.security_patterns` is current — the glob list is user-maintained and can drift from the codebase (no staleness detection in the MVP; see the glob-staleness backlog item).

**Tier-2 deferred**: committed feature-level `review_lenses:` tags (a PR-visible, retrospectively-challengeable provenance artifact, stronger than a session-local trace). Trigger to build: the first production incident where a soft-signal miss ships a real issue.
