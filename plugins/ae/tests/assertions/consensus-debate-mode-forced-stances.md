---
id: consensus-debate-mode-forced-stances
target: ae:consensus
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [team:exists] TeamCreate call occurred with a consensus-debate team
- [behavior] Team has at least one advocate (forced FOR) AND one critic (forced AGAINST) — Debate Mode stances assigned explicitly per agent
- [behavior] Cross-examination rounds ran (evidence: agent-to-agent SendMessages with structured Claims / Evidence / Objection / Confidence format)
- [behavior] TL acts as mediator (NOT as an agent in debate) — TL collects findings, synthesizes verdict
- [text:contains] Final output has a clear verdict: Confirmed / Overturned / Deadlocked

### MUST_NOT
- [behavior] MUST NOT spawn agents in Discussion Mode (equal-participants, no-forced-stances) — consensus is Debate Mode only
- [behavior] MUST NOT let TL take a stance — TL is mediator, NOT a participant

### SHOULD
- [text:contains] Output includes the Disagreement Value Assessment showing where stances converged vs diverged
- [behavior] If deadlocked after 3 cross-exam rounds, escalate to user with evidence preponderance recommendation
