---
id: roadmap-read-only-no-writes
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Principles section states "Lightweight" — no agent teams, no cross-family proxies
- [text:contains] Skill never writes to feature `index.md` size: automatically (display-only auto-eval)
- [text:contains] --resize is the explicit persist path for accepting auto-sized values

### MUST_NOT
- [text:contains] No teammates spawned anywhere in the skill (no Agent tool call — one implicit team, no TeamCreate)
- [text:contains] No Agent tool call anywhere in the skill
- [text:contains] No modifications to feature index.md frontmatter in default invocation

### SHOULD
- [text:contains] Cache file (.ae/cache/auto-size.yml) is the only write target in default invocation, and it is gitignored transient state, not user state
- [text:contains] Section (c) auto-eval reads analysis.md body for unsized features as LLM input
