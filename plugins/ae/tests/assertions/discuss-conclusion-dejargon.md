---
id: discuss-conclusion-dejargon
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Deletions landed (AC3)

- [text:not_contains] The file does NOT contain `## Team Composition` (table deleted; no downstream reader)
- [text:not_contains] The §8 template does NOT contain the count line `Discussion rounds:`
- [text:not_contains] The §8 template does NOT contain the count line `Doodlestein challenges:`
- [text:not_contains] The §8 template does NOT contain `Deferred resolved in Sweep`

#### Dual sentinels preserved (AC3 — load-bearing, prevents /ae:plan breakage)

- [text:contains] The §8 template still contains the `## Process Metadata` header
- [text:contains] The Process Metadata block still contains `Autonomous decisions: N`
- [text:contains] The Process Metadata block still contains `User escalations: N`
- [text:contains] A KEEP comment explains these are /ae:plan dual-sentinel dependencies (references plan/SKILL.md sentinels)

#### F-015 alignment (AC3)

- [structure:order] `## Doodlestein Review` appears AFTER `## Next Steps` in the §8 conclusion template (audit-trail below the fold)
- [text:contains] A prose-alignment pointer to AE Output Standards is present (`Conclusion prose follows` + reference to output-standards.md)
- [text:contains] The `entities:` frontmatter field is still present in the conclusion template
- [text:contains] The `Entity extraction (required)` instruction is still present (consumed by ae:next's "Has discussion" heuristic, untouched)

### MUST_NOT

- [text:not_contains] The Process Metadata KEEP comment does NOT claim the removed counts were "moved to trace" (no invented infrastructure — append-synthesis-trace.sh only records per-round synthesis counts)

### SHOULD

- [text:format] The §8 conclusion template net line count is lower than before F-036 (Team Composition table + 4 count lines removed; only 2 lines + a comment retained in Process Metadata)
