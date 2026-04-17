---
id: roadmap-gaps-validator-runs-checks
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md has `### /ae:roadmap --gaps` section (or equivalent validator subcommand heading)
- [text:contains] SKILL.md names all four audit types: semantic classification, scope-delta, orphan BL-ref, frontmatter integrity
- [text:contains] SKILL.md defines three severities: `error`, `warn`, `info`
- [text:contains] SKILL.md documents CHANGELOG.md version header regex (matches `## v<N>.<N>.<N>`)
- [text:contains] SKILL.md documents BL-ID appearance rule (exact word match on `BL-[0-9]+`)
- [text:contains] SKILL.md handles missing CHANGELOG.md (skip with info-level note)
- [text:contains] SKILL.md explicitly says Audit 1 (semantic classification) produces `error` severity on misclassification
- [text:contains] SKILL.md references the Phase A P1 escape (BL-023/024 misclassification) as the motivating example

### MUST_NOT
- [text:contains] Validator MUST NOT have auto-fix logic in Phase B spec
- [behavior] `--gaps` MUST NOT mutate any files (read-only invariant)

### SHOULD
- [text:contains] SKILL.md includes ID-range filter for orphan audit (skip IDs > current_max + 20)
- [text:contains] Output format includes severity markers `[error]`, `[warn]`, `[info]`
