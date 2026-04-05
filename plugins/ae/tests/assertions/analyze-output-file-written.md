---
id: analyze-output-file-written
target: ae:analyze
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [file:exists] analysis.md exists at `<output.discussions>/NNN-slug/analysis.md`
- [file:contains] analysis.md frontmatter contains fields: `id`, `title`, `type: analysis`, `created`, `tags`
- [file:exists] index.md exists in the same directory as analysis.md
- [file:contains] index.md frontmatter contains `analyze: done` under `pipeline`
- [file:contains] analysis.md contains section `## Question`
- [file:contains] analysis.md contains section `## Findings` with subsections
- [file:contains] analysis.md contains section `## Summary`
- [file:contains] analysis.md contains section `## Possible Next Steps`

### MUST_NOT
- [file:contains] analysis.md frontmatter `type` field MUST NOT be anything other than `analysis`
