---
id: tp-report-write-tool-required
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [file:exists] Report file written to the `output.reviews` path from pipeline.yml
- [file:contains] Report file contains a `## Summary` section
- [file:contains] Report file contains a results table with case, target, layer, class, result columns
- [file:contains] Report file frontmatter includes `type: test-report`
- [behavior] Write tool is called to save the report (displaying only in conversation is not sufficient)

### MUST_NOT
- [behavior] Report exists only in conversation output without a corresponding file on disk

### SHOULD
- [file:contains] Report summary includes pass/fail counts for Layer 1 and Layer 2 separately
- [file:contains] Failed cases have a detail section below the summary table
