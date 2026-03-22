---
id: "001"
title: "Unified ae Plugin File Output Conventions — Conclusion"
concluded: 2026-03-22
plan: ""
---

# Unified ae Plugin File Output Conventions — Conclusion

## Decision Summary

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Output root directory | Superseded, merged into topic 2 | No unified root directory needed |
| 2 | pipeline.yml config granularity | Semantic slots + sensible defaults, no root | SmartPal zero-migration compatible; new projects work out of the box; simple for agents to read |
| 3 | File naming and format conventions | Per-type independent numbering + slug | Simplest to implement, compatible with existing conventions, cross-type chronology via frontmatter |
| 4 | Terminal skill persistence strategy | Temp persistence + proactive save reminder | Solves compact information loss; no forced file bloat; user doesn't need to remember parameters |

## Key Constraints

### Formal Output

1. **pipeline.yml output block is the single source of truth for paths** — all file-writing skills must read paths from here
2. **Every slot has a default value** — omitting config = use default, defaults match SmartPal's existing structure
3. **Unified naming `NNN-slug`** — three-digit number, independently incremented per type, slug generated from title
4. **Unified format Markdown + YAML frontmatter** — must include `id`, `title`, `type`, `created`, `status`

### Temporary Persistence (scratch)

5. **scratch directory defaults to `~/.claude/scratch/<project-hash>/`** — does not pollute repo, reliable across sessions, isolated per project
6. **Optional override in pipeline.yml**: `scratch: "~/.claude/scratch/"` — teams that want teammates to see it can change to `.claude/scratch/`
7. **All skill outputs automatically written to scratch** — information is not lost after session compact/crash/close

### Persistence Reminder Strategy

8. **High-value outputs** (trace, consensus, think) → ask immediately upon completion: "Result saved temporarily. Want to formally save to `docs/xxx/`?"
9. **Pipeline outputs** (code-review, team) → no prompt, auto-write to scratch as action log:
   - Each finding has `action` (fix now / backlog / skip) and `status` (pending / in_progress / resolved)
   - Items going to backlog are written as BL-xxx to `output.backlog`, marked resolved
   - Items fixed on the spot are marked in_progress, then resolved + commit hash when done
10. **Session recovery** — on agent startup, scan scratch; if `status: in_progress` records are found, proactively remind: "There are unfinished operations from last time. Want to continue?"
11. **Feature gate archiving** — during `/ae:review`, show all scratch records from this cycle in bulk and ask the user whether to archive them

### Structural Changes

12. **cross-family-review is not a user skill** — should be moved out of skills/ and converted to a reference document

## pipeline.yml output Block Definition

```yaml
# --- Output Directories ---
output:
  discussions: "docs/discussions/"   # ae:analyze, ae:discuss
  plans: "docs/plans/"              # ae:plan
  milestones: "docs/milestones/"    # ae:work
  backlog: "docs/backlog/"          # ae:work, ae:review, ae:code-review
  reviews: "docs/reviews/"          # ae:review
  analyses: "docs/analyses/"        # ae:think

# --- Scratch (temporary persistence) ---
scratch: "~/.claude/scratch/"        # default value, generally no need to change
```

## scratch action log Format

```yaml
# ~/.claude/scratch/<project-hash>/code-review-2026-03-22-001.md
---
type: code-review
created: 2026-03-22T14:30:00
status: in_progress    # pending | in_progress | resolved
---

## Findings

1. [FIXING] auth.py:42 — SQL injection risk
   - action: fix now
   - status: in_progress

2. [BACKLOG] api.py:88 — missing rate limiting
   - action: BL-072
   - status: resolved → docs/backlog/BL-072-rate-limiting.md

3. [FIXED] utils.py:15 — unused import
   - action: fixed in commit abc123
   - status: resolved
```

## Files That Need Modification

### Template
- `plugins/ae/templates/pipeline.template.yml` — update output block to semantic slots + defaults, add scratch

### Skills (unified path reading/writing + scratch)
- `plugins/ae/skills/analyze/SKILL.md` — change from hardcoded to reading `output.discussions`
- `plugins/ae/skills/discuss/SKILL.md` — change from hardcoded to reading `output.discussions`
- `plugins/ae/skills/plan/SKILL.md` — change to reading `output.plans`, add default value
- `plugins/ae/skills/work/SKILL.md` — change to reading `output.milestones` + `output.backlog`
- `plugins/ae/skills/review/SKILL.md` — change to reading `output.reviews` + `output.backlog` + scratch archiving
- `plugins/ae/skills/think/SKILL.md` — change to reading `output.analyses` + save reminder on completion
- `plugins/ae/skills/setup/SKILL.md` — generation logic to match new template
- `plugins/ae/skills/trace/SKILL.md` — add scratch + save reminder on completion
- `plugins/ae/skills/consensus/SKILL.md` — add scratch + save reminder on completion
- `plugins/ae/skills/code-review/SKILL.md` — add scratch action log
- `plugins/ae/skills/team/SKILL.md` — add scratch

### Structural Changes
- `plugins/ae/skills/cross-family-review/` — move out of skills/, convert to reference document

## Next Steps

→ Run `/ae:plan` based on these decisions to generate an execution plan.
  Reference this conclusion: `docs/discussions/001-unified-output/conclusion.md`
