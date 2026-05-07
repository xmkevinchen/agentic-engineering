---
id: setup-migration-existing-docs
target: ae:setup
layer: 1
source: generated
---

## Context
- Project initialization where `docs/discussions/` already exists with at least one `.md` file (legacy layout)
- No other `docs/<slot>/` dirs have content
- No `.claude/pipeline.yml` exists yet
- `AE_SETUP_NONINTERACTIVE=1` set

## Prompt
Read the ae:setup SKILL.md Step 4 (per-slot directory scan) and describe what `output.*` slots are written to the generated pipeline.yml when `docs/discussions/` is the only legacy dir with content. Are other 5 slots written too, or only the detected one?

## Prompt Variants
- Migration scenario: docs/discussions/ exists. What slots get written?
- Does setup write all 6 slots when only one legacy dir is detected?
