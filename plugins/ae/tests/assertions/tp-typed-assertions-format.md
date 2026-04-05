---
id: tp-typed-assertions-format
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md defines [file:exists], [file:changed], [file:contains] assertion tags
- [file:contains] SKILL.md defines [team:exists] assertion tag
- [file:contains] SKILL.md defines [text:contains] and [text:regex] assertion tags
- [file:contains] SKILL.md defines [behavior] assertion tag for LLM-judge-only assertions
- [file:contains] SKILL.md specifies [file:*], [team:*], [text:*] use mechanical verification
- [file:contains] SKILL.md specifies [behavior] always routes to configured judge
- [file:contains] SKILL.md specifies MUST/MUST_NOT are gate assertions (any failure = case FAIL)
- [file:contains] SKILL.md specifies SHOULD assertions are advisory (failure noted but not case FAIL)

### MUST_NOT
- [file:contains] SKILL.md routes [behavior] assertions to mechanical verification
- [file:contains] SKILL.md routes [file:*] or [text:*] to LLM judge
