---
id: "04"
title: "Terminal Skill Persistence Strategy"
status: decided
created: 2026-03-22
decision: "D — Temp persistence + proactive save reminder"
rationale: "Solves the session compact information loss problem. All outputs are automatically written to a temp file, and the skill proactively asks the user whether to formally save after completion. No need for the user to remember parameters, and no information is lost."
---

# Topic: Terminal Skill Persistence Strategy

## Background

Currently 5 skills output only to the terminal: code-review, consensus, trace, team, cross-family-review. Of these, cross-family-review is passive reference documentation that does not produce content and is out of scope for this discussion.

The core problem is not just "should we write files" — it's that **session compact can lose information**. A dependency graph from `/ae:trace` or three rounds of debate from `/ae:consensus` may be reduced to a summary or disappear entirely after compact.

## Options

### A: Keep all terminal output as-is

Do not change any terminal skill behavior.

- **Pros**: Simplest; adds no complexity
- **Cons**: Information lost after compact; review phase cannot reference previous trace output

### B: opt-in persistence for trace and consensus (`--save` parameter)

Default is terminal output; write to formal directory when user adds `--save` parameter.

- **Pros**: Persist on demand, not forced
- **Cons**: User must know in advance they want to save; forgetting the parameter means it's gone; compact problem unsolved

### C: All analysis-type skills default to persistent output

trace, consensus, think all write files by default.

- **Pros**: Knowledge is not lost
- **Cons**: File bloat; some outputs are only for temporary viewing

### D: Temp persistence + proactive save reminder (option emerging from discussion)

Two-layer strategy:

1. **Automatic temp persistence**: all content-producing skills automatically write a temp file (`.claude/scratch/`) on completion, invisible to the user. Solves compact information loss.
2. **Proactive reminder**: skill asks the user after completion "Do you want to formally save this result?"
3. **Formal save**: on user confirmation, move to the corresponding output slot (e.g. `docs/traces/001-auth-flow.md`)
4. **No save**: temp file is retained until next cleanup or session end

Scope of application:
- `trace` — dependency graph has reference value at plan phase → ask
- `consensus` — debate conclusion has reference value at discuss phase → ask
- `code-review` — quick review before each commit, high volume and temporary → don't ask, temp save only
- `team` — agent selection process, purely temporary → don't ask, temp save only

- **Pros**: Compact-safe; user doesn't need to remember parameters; proactive reminder prevents omissions; no forced file bloat
- **Cons**: Requires `.claude/scratch/` temp directory management; one extra interaction step

## Recommendation

Recommend **D**. Solves option B's "forgetting the parameter" problem and option C's "file bloat" problem, while thoroughly addressing the core pain point of compact information loss.

## Note: Where does cross-family-review belong?

`ae:cross-family-review` is passive reference documentation, not a user-invokable slash command, and produces no output. Consider moving it out of skills/ to a more appropriate location (e.g. docs/ or a reference document within agents/).
