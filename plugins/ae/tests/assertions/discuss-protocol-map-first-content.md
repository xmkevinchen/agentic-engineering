---
id: discuss-protocol-map-first-content
target: ae:discuss
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [structure:order] First non-frontmatter content is a bold "Protocol Map" line
- [text:contains] Protocol map contains "if detail for any step is missing below, read this SKILL.md file directly before proceeding"
- [structure:order] Protocol map lists all 10 steps in order: 1.Setup, 2.Spawn Team, 3.Discussion Rounds, 4.Consensus Verification, 5.TL Scores, 6.Present & Record, 7.Doodlestein, 8.Sweep, 9.Conclusion, 10.Shutdown
- [structure:order] Protocol map appears before any ## section heading

### MUST_NOT
- [structure:order] No ## heading appears before the Protocol Map
- [structure:completeness] No step from the 10-step sequence is omitted from the Protocol Map

### SHOULD
- [text:format] Protocol Map is visually distinct (bold or heading-like formatting)
