# Scorer Inputs — Phase 2 Validation Archive

Project-profile input fixtures used by `compute-rbo.py` when validating the (now-deprecated) 6-signal deterministic scorer.

## Status

**Historical only.** Paired with `../scorer-runs/` outputs. The scorer spec these test against has been deprecated — see `plugins/ae/skills/setup/agent-selection-scorer.md.deprecated`. Current selection uses `plugins/ae/skills/setup/agent-selection-rubric.md`.

## Files

Each `<project>.json` is a synthetic or real project profile (CLAUDE.md excerpts, tech-stack summary, description) used as scorer input. Comments mentioning "scorer's graceful degradation" or "noise-floor" describe the deprecated mechanism — preserved for archival fidelity; not a claim the current system works this way.
