---
id: roadmap-batch-approval-askuserquestion
target: ae:roadmap
layer: 1
source: generated
---

## Context
- F-007 Step 1 added a 2-step AskUserQuestion flow to `/ae:roadmap` section (a) batch-approval block
- Step A fires after the approval block is rendered; Step B fires only when "Remove some" is chosen at Step A

## Prompt
Read the ae:roadmap SKILL.md section (a) "Batch-approval block" subsection. Describe the 2-step AskUserQuestion flow. Specifically: what are the exact options at Step A? When does Step B fire? What's the multi-select used for? What's the cancel-with-disambiguation label?

## Prompt Variants
- What happens when the user types "Approve all" at Step A?
- When does the multi-select prompt appear?
- Is the cancel option available at every step?
