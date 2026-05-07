---
id: setup-no-output-block
target: ae:setup
layer: 1
source: generated
---

## Context
- Fresh project initialization (no existing `.claude/pipeline.yml`)
- Project has no `docs/<slot>/` legacy directories with content
- `AE_SETUP_NONINTERACTIVE=1` set (deterministic mode)

## Prompt
Read the ae:setup SKILL.md Step 3 + Step 4 + the pipeline.template.yml and describe what the generated `.claude/pipeline.yml` looks like for a fresh GTD-first project (no legacy dirs). Specifically: does it contain an uncommented `output:` block?

## Prompt Variants
- For a brand-new project, does ae:setup write the 6-slot output: block?
- What's in pipeline.yml after fresh init when no docs/* dirs exist?
