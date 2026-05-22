---
id: plan-review-solo-preserves-draft
target: ae:plan-review
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Pre-check 1 contains the prose `Plan stays \`status: draft\`. Re-run under Agent Teams to promote to reviewed.`
- [text:contains] SKILL.md Apply and Confirm section contains BOTH headers `[Agent Teams mode]` AND `[solo fallback mode]` (split branches)
- [text:contains] SKILL.md solo fallback mode branch explicitly states the plan frontmatter preserves `status: draft` (does NOT write `status: reviewed`)
- [text:contains] SKILL.md cross-links to `docs/agent-teams-policy.md` from the solo-mode message

### MUST_NOT
- [text:contains] SKILL.md MUST NOT contain a code path where the solo fallback mode writes `status: reviewed` to plan frontmatter
- [text:contains] SKILL.md MUST NOT remove the Agent Teams mode promotion path (Agent Teams mode still promotes draft → reviewed)

### SHOULD
- [text:contains] Solo-mode message instructs user to enable Agent Teams and re-run `/ae:plan-review` to promote
- [behavior] When solo fallback path is taken, the final plan file has `status: draft` (not `status: reviewed`)
