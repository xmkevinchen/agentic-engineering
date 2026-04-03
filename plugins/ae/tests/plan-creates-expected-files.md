---
id: plan-creates-expected-files
target: ae:plan
layer: 2
source: manual
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Input is a feature description (not a discussion reference)

## Prompt
/ae:plan add a health check endpoint to the API

## Prompt Variants
- /ae:plan implement rate limiting for API endpoints
- /ae:plan create user profile page

## Expected Behavior

### MUST
- [file:exists] A plan file is created under `output.plans` directory
- [file:contains] Plan file contains `## Steps` section
- [file:contains] Plan file contains `## Acceptance Criteria` section
- [file:contains] Plan file frontmatter contains `status: draft` or `status: reviewed`

### MUST_NOT
- [file:contains] No step without `Expected files:` line (per REQUIRED template rule)

### SHOULD
- [behavior] Each AC is specific and verifiable (not vague like "results should be reasonable")
- [behavior] Each step references AC numbers
- [behavior] `Expected files:` lists contain real file paths (not just placeholders)
