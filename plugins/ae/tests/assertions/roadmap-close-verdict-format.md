---
id: roadmap-close-verdict-format
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] section (a) LLM judgment emits a `CLOSE` verdict with a deterministic phrasing and a `Supersession evidence:` continuation line
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] a `Supersession scan` step runs after Filtering Constraints and before LLM judgment, producing evidence in two tiers
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Tier 1 = origin_bl exact-ID match (mechanical, zero-false-positive, reliable CLOSE); Tier 2 = keyword grep (semantic, ADVISORY ONLY, never auto-acts)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] CLOSE only on evidence: Tier-2 grep alone requires the LLM to read the cited feature/plan + tag `[advisory]`; insufficient confirmation → fall back to WAIT, never CLOSE on grep-alone
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Tier-2 grep targets feature-resident plans `.ae/features/{active,done}/F-*/plan.md` (not the post-F-025-empty `.ae/plans/`)

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] MUST NOT allow a Tier-2 (advisory grep) match alone to produce a CLOSE verdict without reading the cited evidence
