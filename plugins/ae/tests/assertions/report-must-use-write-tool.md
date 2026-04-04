---
id: report-must-use-write-tool
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [file:exists] Report file created under `output.reviews` directory
- [file:contains] Written file contains a Summary section
- [file:contains] Written file contains a results table

### MUST_NOT
- [behavior] Report only appears in conversation without being persisted to file

### SHOULD
- [text:regex] Filename includes date pattern (\d{4}-\d{2}-\d{2})
- [file:contains] Summary section includes pass/fail counts
