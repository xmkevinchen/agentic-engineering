---
id: test-plugin-typed-assertions-defined
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- SKILL.md for ae:test-plugin is readable

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- Typed assertion format defines [file] type with operators (exists, changed, contains)
- Typed assertion format defines [team] type with exists operator
- Typed assertion format defines [text] type with operators (contains, regex)
- Typed assertion format defines [behavior] type (LLM judge only)
- Dispatch rules specify mechanical verification for [file], [team], [text]
- Dispatch rules specify LLM judge for [behavior]
- MUST/MUST_NOT are gate assertions (failure = case FAIL)
- SHOULD assertions are advisory

### MUST_NOT
- [behavior] assertions routed to mechanical verification
- [file]/[team]/[text] assertions require LLM judge
