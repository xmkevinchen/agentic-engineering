---
id: plan-creates-expected-files
target: ae:plan
layer: 2
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
- A plan file is created (Write tool called with path matching `output.plans` directory)
- Plan file contains `## Steps` section
- Plan file contains `## Acceptance Criteria` section
- Plan file frontmatter contains `status: draft` or `status: reviewed`

### MUST_NOT
- No step without `Expected files:` line (per REQUIRED template rule)

### SHOULD
- Each AC is specific and verifiable (not vague like "results should be reasonable")
- Each step references AC numbers
- `Expected files:` lists contain real file paths (not just placeholders)
