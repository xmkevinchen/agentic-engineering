---
id: setup-no-output-block
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] setup/SKILL.md Step 3 instructs to skip writing the `output:` block on fresh init
- [text:contains] setup/SKILL.md Step 4 only writes a slot when content exists in non-default location
- [text:contains] pipeline.template.yml comments out the `output:` block (no uncommented defaults)
- [text:contains] Reader skills' canonical defaults `.ae/<slot>/` apply implicitly when slot absent from pipeline.yml

### MUST_NOT
- [text:contains] setup/SKILL.md does NOT instruct to write 6 slots by default
- [text:contains] pipeline.template.yml does NOT contain uncommented `output: discussions: "docs/discussions/"` (or any of the 6 slots) at the top level
- [text:contains] Fresh-init flow does NOT create `output.<slot>` keys when corresponding directory has no content

### SHOULD
- [text:contains] Template comment block explains the rationale (GTD-first, .ae/features/ canonical, output.* is for legacy/customization)
