---
id: testgen-qa-security-agents-required
target: ae:testgen
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Step 2 spawns a `qa` agent for test plan completeness review
- [text:contains] SKILL.md Step 2 spawns a `security-reviewer` agent for security test case review
- [behavior] SKILL.md requires both qa and security-reviewer agents in the team

### MUST_NOT
- [behavior] MUST NOT skip security-reviewer agent in Step 2 team
- [behavior] MUST NOT assign security review work to the qa agent

### SHOULD
- [text:contains] qa agent checks: all code paths covered, edge cases, error handling
- [text:contains] security-reviewer checks: injection, auth bypass, data leaks
