---
id: discuss-appendix-section-exists
target: ae:discuss
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [structure:exists] `## Appendix: File Formats` heading exists in the file
- [structure:order] Appendix appears after Step 10 (Team Shutdown & Next Steps) and the Principles section
- [text:contains] Appendix contains templates for: topic directory structure, summary.md, round-NN.md, index.md

### MUST_NOT
- [structure:location] File format templates do not appear inline within Steps 1-10 body content
- [structure:order] Appendix heading does not appear before Step 10 or Principles

### SHOULD
- [text:contains] Steps 1-10 contain a cross-reference such as "File format templates are in the Appendix at the end of this file" instead of inline templates
