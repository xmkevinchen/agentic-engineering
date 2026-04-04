---
id: work-autopass-security-pattern-always-pause
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check B states: `If unexpected files match pipeline.yml → work.security_patterns → option 2 unavailable, must fix or get human review.`
- [behavior] When unexpected files match `security_patterns`, option 2 ("Approve drift: explain why") MUST be removed from the options list
- [behavior] Gate MUST pause — security pattern match always blocks auto-pass

### MUST_NOT
- [behavior] MUST NOT offer "Approve drift: explain why" as an option when security patterns are matched
- [behavior] MUST NOT auto-continue when unexpected files match security patterns, even if all other gate conditions are met
