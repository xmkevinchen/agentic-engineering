# Agentic Engineering Plugin Development

## Language Convention

- **聊天** — 中文（与 user 的对话）
- **Git-tracked docs** — English（仓库里 committed 的文件：README, CHANGELOG, SKILL.md, agent definitions, `docs/` 下的 references/decisions 等）
- **非归档 docs** — 中文（gitignored 的过程产物：`.ae/` 下的 discussions / plans / reviews / analyses / milestones）

## Versioning

Version bumps are for **intentional releases**, not every commit. Accumulate changes and bump once when there's a meaningful release.

When releasing:
1. `plugins/ae/.claude-plugin/plugin.json` — bump version (semver: patch for enhancements, minor for new components)
2. `CHANGELOG.md` — document changes
3. `README.md` — verify component counts

## Directory Structure

```
.claude-plugin/
└── marketplace.json    # Marketplace manifest (repo = marketplace)

plugins/ae/             # The actual plugin
├── .claude-plugin/
│   └── plugin.json     # Plugin manifest (name: "ae")
├── skills/             # Slash commands (/ae:plan, /ae:work, etc.)
│   ├── plan/SKILL.md
│   ├── work/SKILL.md
│   └── ...
├── agents/             # Subagents (ae:workflow:architect, etc.)
│   ├── review/
│   ├── research/
│   └── workflow/
├── mcp-servers/        # Bundled MCP servers (Gemini)
└── templates/          # pipeline.yml template for /ae:setup
```

## Naming Convention

- SKILL.md `name` field MUST include `ae:` prefix (e.g. `name: ae:plan`)
- This ensures `/ae:plan` shows in autocomplete, not just `/plan (ae)`
- Agent names are auto-prefixed by plugin system

## Git

- **Feature branch** — all work on feature branches, PR to main. Branch naming: `feature/<slug>` or `fix/<slug>`
- Never push to remote unless explicitly approved by the user

## Project Management (GTD)

AE uses **GTD (Getting Things Done)** as its project management model. Skills map to GTD's 5+1 phases (plus an AE-self-development sidebar):

| GTD Phase | AE Skill | Artifact Path |
|---|---|---|
| **Capture** | `ae:backlog` | `.ae/backlog/unscheduled/BL-NNN-slug.md` (inbox; sibling subdirs `closed/` and `done/` hold terminal-state BLs) |
| **Clarify** | `ae:roadmap` | scan backlog → promote candidates + feature dependency analysis + size aggregate + roadmap archive prompt |
| **Organize** | `ae:analyze` | promote BL → `.ae/features/active/F-NNN-slug/` with initial size + depends_on |
| **Reflect (short-cycle)** | `ae:dashboard` + `ae:next` | default reads `features/active/`; `--all` includes done + abandoned |
| **Reflect (long-cycle)** | `ae:retrospect` | project-level review of `features/done/` — what shipped + lessons learned |
| AE plugin self-stats | `ae:plugin-stats` | independent of project retrospect; preserves the old `ae:retrospect` parser + 23 existing review records |
| **Engage** | `ae:discuss` / `ae:plan` / `ae:work` / `ae:review` | execute inside feature dir; `ae:review` verdict pass triggers archive |
| **Archive** *(GTD Reflect sub-phase)* | `ae:review` (feature-level) + `ae:roadmap` (roadmap-level) | feature: mv `active/` → `done/`; roadmap: all features done → mv `roadmaps/active/X.md` → `roadmaps/done/X.md` |

`/ae:retrospect` = project-level long-cycle Reflect (GTD Weekly Review style). `/ae:plugin-stats` = AE plugin self-development outcome stats (delivery metrics, separated from product retrospective per OpenAI/Google patterns).

### Feature directory layout

```
.ae/features/
├── active/      # in-flight features (most lookups read this)
├── done/        # archived after ae:review verdict pass
└── abandoned/   # started then dropped (superseded / not doing)

.ae/features/active/F-NNN-slug/
├── index.md       # feature frontmatter + GTD state
├── analysis.md    # ae:analyze research output (when applicable)
├── BL-NNN.md      # original BL file (preserved name for grep / cite)
└── ...            # discuss/plan/work/review outputs (path migration in plan 051)
```

### Feature index.md frontmatter schema

```yaml
# Required
id: F-NNN
title: "<feature title>"
status: active        # active | done | abandoned
created: YYYY-MM-DD

# Optional (GTD-related)
theme: <tag>          # grouping in ae:roadmap theme view
roadmap: <name>       # link to .ae/roadmaps/active/<name>.md
size: M               # T-shirt: XS (<1d) | S (1d) | M (2-3d) | L (≈1w) | XL (>1w)
depends_on: [F-MMM]   # other features that must complete first
origin_bl: BL-042     # or list: [BL-042, BL-051] for multi-BL consolidation
done: YYYY-MM-DD      # set when status transitions to done
abandoned: YYYY-MM-DD
abandoned_reason: "<why>"

# Optional (user-defined — no enum constraint)
# priority, assignee, notes, or any user-added field
```

### Reader contract

All skills that read feature `index.md` frontmatter (`ae:analyze`, `ae:roadmap`, `ae:dashboard`, `ae:next`, `ae:retrospect`, `ae:review`) MUST be **reader-tolerant**:
- **Unknown fields** (not in this schema) → silently ignore. User-defined fields are metadata-only; any field that drives automated skill logic (sorting, filtering, routing, archive triggers) MUST be promoted into this schema first.
- **Known field with unknown enum value** (e.g., `status: paused`) → log warning, preserve value as-is, skip the feature from enum-dependent workflows. Do NOT silently coerce to a default.
- **Missing optional field** → graceful default (treat as absent, not invalid).
- **Missing required field** (`id` / `title` / `status` / `created`) → log error, skip this feature record; continue scanning other records.
- **List-or-scalar fields** (`origin_bl`, `depends_on`): readers MUST normalize to list internally — `origin_bl: BL-042` and `origin_bl: [BL-042, BL-051]` are semantically equivalent.
- **Missing `theme`**: features without a `theme:` value group under a uniform bucket named `(unthemed)` — never invented from title or body. All grouping skills (`ae:roadmap` section (a) feature listing, `ae:retrospect` section (1) recently-shipped grouping) MUST use this exact bucket name to prevent silent divergence.

### Path classes (Plan 051+)

AE distinguishes two classes of paths in the project tree:

- **`.ae/features/{active,done,abandoned}/`** — **fixed AE internal state** (not configurable). The directory layout is hardcoded into reader skills (`ae:dashboard`, `ae:next`, `ae:roadmap`, `ae:retrospect`, `ae:plugin-stats`). External projects DO NOT override these paths via `pipeline.yml` — they are AE convention.
- **`output.{plans,reviews,discussions,milestones,backlog,analyses}`** — **configurable legacy/external-customization paths** in `pipeline.yml`. Existing projects with custom `output.discussions: docs/discussions/` etc. continue to work; these paths host pre-Plan-051 legacy artifacts AND host post-Plan-051 free-text/standalone artifacts that don't resolve to a feature dir.

Without this distinction, external-project users won't know which paths they can override and which are AE internal convention.

**`.gitignore` policy**: the existing `.ae/` blanket gitignore (top-level) covers `.ae/features/{active,done,abandoned}/F-NNN-<slug>/` and all artifacts inside (plan.md, review.md, discussions/, milestones/, etc.). External projects don't need per-subdir overrides; the `.ae/` line is sufficient. AE internal state stays local to each working tree.

### Path-derived feature ID convention (Plan 051+)

For feature-resident plan, review, and discussion artifacts inside `.ae/features/<state>/F-NNN-<slug>/`, the feature ID is **path-derived** from the parent directory name. Readers MUST extract `F-NNN` from the directory path; this is the canonical lookup.

- **Optional `feature:` frontmatter** on plan/review/discussion files (NOT on the feature `index.md` — that container already encodes `id: F-NNN`): when present, readers validate frontmatter matches path-derived `F-NNN` and warn on mismatch. **Path always wins.** When absent, readers derive ID from path silently.
- **Legacy plan/review/discussion files** (under `output.plans/`, `output.reviews/`, `output.discussions/`) have no `feature:` field. They link to features (when applicable) via `discussion:` chains or are unaffiliated.
- **Reader behavior**: skills that surface review/plan state across the project MUST scan BOTH `output.{plans,reviews,discussions}/` (legacy) AND `.ae/features/{active,done,abandoned}/F-*/...` (feature-resident) — union the results. No surface-index pointer files; readers, not writers, bridge the two locations.

### Schema evolution

To add a new field: update this section AND the SKILL.md files that consume it. No Liquibase versioning, no separate `schema.md` file (intentional — supersedes discussion 052's heavier proposal).

### Legacy artifacts

The 175 pre-existing `.ae/discussions/`, `.ae/plans/`, `.ae/reviews/` artifacts are **legacy** — they stay where they are; new work goes through `.ae/features/`. `ae:dashboard` and `ae:next` hide legacy by default; pass `--legacy` to surface them.

## Design Principles

- **Self-bootstrapping** — AE develops AE. All changes to this plugin go through the AE pipeline (discuss→plan→work→review). This is the default working mode, not a special case.
- **Project-agnostic** — skills and agents read project context from CLAUDE.md and pipeline.yml
- **Extensible** — projects define their own agents (developers, code reviewers) in pipeline.yml
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **Agent Teams** — parallel multi-agent workflows with structured communication protocols
- **先运行后决策** — new skills or significant skill changes must be followed by at least one real execution before the next discussion/plan cycle

## Agent Definition Principles

- **No duplication** — if a concept is already in the agent definition, don't add it again with different wording
- **One-line rules** — prefer `- Rule summary` over multi-paragraph explanation
- **Test after changes** — any agent definition modification must be followed by running a real task to verify no regression
- **No self-check steps** — don't add "verify your output" instructions; they add hesitation without enforcement
- **Size awareness** — if an agent definition exceeds ~100 lines, review for bloat

## TL Autonomy Boundary

TL (Team Lead / Claude) decides autonomously by default:
- Topic convergence, agent selection, round management, Doodlestein execution
- Resolving deferred items in Sweep
- Choosing between options when evidence clearly supports one

TL escalates to user only when:
- Low-reversibility decision with genuine ambiguity
- Domain context only user has
- Topic directly affects user's workflow or preferences

### Operational Rules (agents inherit these)

- **P3 auto-skip** — P3 findings in code review: skip without asking user
- **P2-style auto-skip** — P2 style/naming findings: skip without asking user
- **Single-option converge** — discussion topic with only one viable option: converge directly
- **High-reversibility fast-track** — all topics high-reversibility: TL may converge in one round
- **Doodlestein dismiss** — TL dismisses a challenge: record reason, do not ask user to confirm
- **Review findings triage** — only P1 and P2-logic/security require user disposition
