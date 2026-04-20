# Scorer Runs — Phase 2 Validation Archive

These JSON files are **archival evidence** from BL-005 Phase 2 validation — the empirical data that justified killing the 6-signal deterministic scorer in favor of LLM-based selection.

## Status

**Historical only.** The spec being tested (`plugins/ae/skills/setup/agent-selection-scorer.md`) has been deprecated and archived as `plugins/ae/skills/setup/agent-selection-scorer.md.deprecated`. The current agent-selection spec is `plugins/ae/skills/setup/agent-selection-rubric.md` (LLM-based).

References to `agent-selection-scorer.md` inside these JSON files (`spec_citations` arrays etc.) point at the now-renamed `.deprecated` file and are kept for archival fidelity — they describe what spec was in effect at the time each session ran. Do not rewrite those paths; they are time-stamped evidence, not live citations.

## Files

- `ae-self-session-{1,2}.json` — two independent runs on the AE project itself
- `mengdie-session-{1,2}.json` — two runs on the Mengdie knowledge-server project
- `*-metrics.json` — compute-rbo.py summary outputs

## What the data shows

Across all 4 sessions × 2 projects, the 6-signal scorer produced **0 confident matches** (all agents scored below 0.35 threshold). This collapse motivated the Phase 2 pivot to LLM-based selection. See the rubric's "Why Not Mechanical Scoring (Phase 2 Pivot Note)" section for the retrospective.
