---
id: team-missing-pipeline-yml
target: ae:team
layer: 1
source: generated
---

## Context

- Project directory has NO `.claude/pipeline.yml`
- Pre-check step 1 verifies pipeline.yml exists; step 2 specifies auto-run `/ae:setup` if missing

## Prompt

/ae:team "review security of auth module"

## Prompt Variants

- Variant: `.claude/` directory exists but `pipeline.yml` is absent
- Variant: `.claude/` directory does not exist at all
