# Agent Selection Rubric

LLM-based matching rubric for two use cases:

1. **Setup-time curation** — `/ae:setup agents --suggest`: Claude reads project context + library agents, proposes a curated subset to import into `.claude/agents/` (populates the primary pool).
2. **Runtime dispatch** — `ae:plan` / `ae:work` / `ae:review` / `ae:discuss` spawning agents per task: Claude picks from primary pool first, falls back to library scan only if primary has no fit.

The rubric applies identically to both use cases; what differs is the candidate scope (library only for `--suggest`; primary pool → library fallback for runtime). See `plugins/ae/skills/agent-selection/SKILL.md` § Layer 2 for runtime flow mechanics.

This doc is **guidance for Claude's judgment**, not a mechanical spec. No weights, no thresholds, no math. The goal is concise, opinionated recommendations — not exhaustive scoring.

## Context Claude Reads

**Project side**:
- `CLAUDE.md` — tech stack, architecture, what the project does
- Latest `.ae/analyses/*.md` by mtime (if present) — current focus
- Latest active `.ae/discussions/*/index.md` (if present) — what's being worked on
- `pipeline.yml`: `project_agents:` (already imported), `agent_libraries:` (declared sources)
- Built-in AE agents roster at `plugins/ae/agents/` — what's covered out of the box
- `.claude/agent-governance.md` (if present) — user's `force` / `exclude` / `prefer` rules

**Candidate side** — two tiers:

1. **Primary pool** (scanned first, always in context):
   - AE built-ins (`plugins/ae/agents/{workflow,review,research}/*.md`)
   - User agents (`~/.claude/agents/*.md`)
   - Project agents (`.claude/agents/*.md`)
   - Metadata from `pipeline.yml` `project_agents[]`
2. **Library fallback** (only scanned when primary pool has no fit):
   - `agent_libraries[].source` directories, enumerated `**/*.md`

Per candidate, read:
- Frontmatter: `name`, `description`, `role`, `tech_stack`, `specialty`, `category` (dir path)
- Body first ~20 lines (only if description is thin / ambiguous)

## Rubric (what to look for)

When evaluating a candidate agent, consider in roughly this priority order:

1. **Task fit** — does the agent's stated purpose align with what this project actually does? (e.g., Mengdie is a Rust MCP knowledge server → ML/embeddings/DB-optimization agents fit; CRM/marketing agents don't)
2. **Tech stack compatibility** — if the agent declares a stack (`laravel`, `solidity`, `rust`), does it match? Mismatch = hard no, regardless of other signals.
3. **Role coverage gap** — what roles are missing? Built-ins cover `reviewer` + some `domain-expert`. If a candidate fills a gap (e.g., `developer` role), that's a positive signal.
4. **Specialty specificity** — prefer agents with a focused niche over generic "software engineer" agents. The specific ones either fit sharply or don't; the generic ones add little over built-ins.
5. **Description quality** — if the description is too thin to judge (<30 chars or pure marketing), skip; don't guess.

## Hard Constraints (mechanical, applied before LLM judgment)

These are applied deterministically before Claude sees the candidate pool:

- **`action: force`** (from governance) → agent pre-selected, not subject to LLM filtering
- **`action: exclude`** → agent removed from candidate pool
- **`action: prefer`** → Claude is told this preference and may weight it; no mechanical bonus

## Output Shape

Target **3-8 recommendations**. Prefer fewer confident matches over padding the list.

Per recommendation, Claude writes one or two sentences:
- **What the agent does** (not a paraphrase of the description — what's actually useful here)
- **Why it fits this project** (cite specific evidence from CLAUDE.md or recent analyses/discussions)

If nothing fits well:
```
No library agents fit this project well.
Suggestions:
- Browse `/ae:setup agents --list --category <...>` manually
- Consider writing a custom agent in .claude/agents/ tailored to this project
```

## `--why` Output Template

When `--why` is passed, extend each recommendation with:
- **What fits** — 1-2 bullet points citing project evidence
- **What doesn't fit** — 1 bullet point noting any caveats (e.g., "description is generic — may overlap with built-in architect")
- **What was considered but rejected** — 2-3 rejected candidates with 1-line reason each

Goal: user can tell whether Claude actually read the context vs boilerplate-matching.

## `--phase` Flag Behavior

If `--phase <early|build|scale|maintenance>` is passed, include in Claude's prompt:

> "This project is in the `<phase>` phase. Bias toward agents that fit this stage."

| Phase | Favored direction |
|-------|-------------------|
| `early` | architect, minimal-change-engineer, rapid-prototyper |
| `build` | reviewer, security-engineer, technical-writer, developer |
| `scale` | performance-engineer, devops, sre, incident-response |
| `maintenance` | bug-hunter, refactorer, deprecation-specialist |

No mechanical weight shifts — just context for Claude's judgment.

## `--refresh` Advisory Behavior

For `/ae:setup agents --refresh` — an audit of current `project_agents` against current project state:

Claude reads:
- Each currently-imported agent in `project_agents`
- Current project `CLAUDE.md`, recent analyses/discussions
- Current library contents

Emits three advisory lists (no auto-changes):

1. **Unused imports** — imports that don't show up in recent `.ae/milestones/*/step-summaries.md` or team-run logs (if any exist)
2. **New candidates** — library agents that would now rank higher than some current imports (project has evolved)
3. **Stale mismatches** — imports whose declared stack no longer matches current project stack

## Why Not Mechanical Scoring (Phase 2 Pivot Note)

The initial BL-005 design (Discussion 040 Topic 06) specified a 6-signal deterministic scorer: keyword_overlap / description_match / role_gap_bonus / category_match / library_source_boost / stack_mismatch, aggregated with fixed weights and a 0.35 threshold.

Phase 2 validation (2026-04-18/19) found:
- Keyword/Jaccard signals collapse when the project corpus is normal-size (~700-1100 tokens) — description_match stays below 0.03 for every agent
- Threshold only passes when role_gap + category both happen to fire (coincidental white-space bonuses)
- 3 validation profiles produced 0/179, 0/185, 0/169 recommendations — the real Mengdie dogfood only worked because `engineering/` category happened to match "engineering" in CLAUDE.md
- Doodlestein review in Discussion 040 challenged within-framework details but never the framework choice itself

Root cause: **semantic matching between agent descriptions and project context is an LLM-native problem**, and the scorer was approximating semantics via word-frequency statistics on a tiny corpus. The approximation never converges to usable output without per-project retuning.

The original phased plan ("Phase 1 = deterministic scorer, Phase 4 = LLM fallback for low-confidence cases") was built on the assumption that low-confidence is the edge case. Real data showed low-confidence is the norm. LLM judgment is promoted from fallback to main path.

Kept from the 6-signal work:
- Governance `force`/`exclude`/`prefer` rules (still mechanical, still useful)
- pipeline.yml schema (`agent_libraries:` + `project_agents:`)
- Agent frontmatter contract (`role`, `tech_stack`, `specialty`)
- `/ae:setup agents` subcommand surface (`--library`, `--list`, `--add`, `--remove`, `--sync`, `--detach`, `--refresh`, `--suggest`, `--why`)
- Mengdie's 6 imported agents

Discarded:
- 6-signal scoring math
- Weights, thresholds, noise-floor caps
- Stopword list for scoring (Claude doesn't need stopwords)
- Stack detection via file-extension distribution (Claude reads CLAUDE.md directly)
- RBO-based validation methodology
