# Agentic Engineering Plugin Development

<!-- BEGIN MANAGED: forgejo-workflow -->
@project-management.md

For tracked work, use `/forgejo:create`, `/forgejo:update`, `/forgejo:start`, `/forgejo:block`, or `/forgejo:close` as appropriate.
Run `/forgejo:sync` on tracked-work session entry, before selection/mutation, and after changes.
Treat `project-work.md` as a historical snapshot, never as authority or priority.
<!-- END MANAGED: forgejo-workflow -->

## Language Convention

All git-tracked files in this repository are written in English: `README.md`, `CHANGELOG.md`, every `SKILL.md`, agent definition files under `plugins/ae/agents/`, and everything under `docs/` (references, public-facing guides). Process artifacts under `agent-memory/` (tracked in a separate private memory repository — discussions, plans, reviews, analyses, milestones) may use whatever language is convenient for the working session; they never ship to the published repository. Local-only contributor notes (such as `CLAUDE.local.md` and files under `docs/decisions/`) follow the same convenience-language policy and are kept out of the repository.

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
├── skills/             # The entry and the five stages
│   ├── go/SKILL.md     #   the entry: runs a work item through the stages
│   ├── analyze|discuss|plan|work|review/SKILL.md
│   └── ...
├── agents/             # Subagents (ae:workflow:architect, etc.)
│   ├── review/ research/ workflow/ engineering/
├── scripts/            # The session-start probe, its reader, the Codex seat runner, the test runner
├── mcp-servers/        # Bundled MCP servers (Gemini, OpenAI-compatible)
├── v1/                 # The Phase 1 Kernel, built against its own frozen Contract
└── templates/          # pipeline.yml template
```

## Naming Convention

- SKILL.md `name` field is the bare skill segment (e.g. `name: plan`), matching its directory
- Claude Code prepends the plugin namespace itself, so `name: plan` autocompletes as `/ae:plan`
- Agent names are auto-prefixed the same way; a `:` in either field is rejected or doubled

### Internal terminology referenced in skill/agent prose

Skill definitions and agent files occasionally cite the following internal terms. They are project artifacts, not external concepts:

- **`F-NNN`** — a *feature* identifier. Features live under `agent-memory/features/{active,done,abandoned}/F-NNN-<slug>/` (separately versioned process artifacts). When a SKILL.md says e.g. "F-019 cast-block protocol" it is naming a specific past feature that introduced the protocol now described.
- **`BL-NNN`** — a *backlog item* identifier (idea / task / known gap). Backlog files live under `agent-memory/backlog/` (tracked in the memory repository). When prose says "BL-076" it is citing the backlog entry that produced or motivated the surrounding behavior.
- **`Plan NNN`** — a *legacy plan number* from the pre-feature-directory era of this plugin's own self-development. Plans now live inside their feature dir; references to `Plan 0XX` in older prose mean "the historical plan record that established the behavior being described". They are archaeological references, not currently-tracked artifacts.
- **`KL #N`** — a *knowledge-ladder* finding number; cited only in `plugins/ae/skills/review/SKILL.md` as part of a synthesis-quality check the reviewer applies.

These identifiers do not need to be resolved to understand what a skill does — they are provenance hooks for contributors interested in the design history.

## Repo-entering text discipline

Everything that lands in the repository — code comments, commit messages, skill/agent prose, tests, docs — describes the WORK, never the review conversation that shaped it:

- **Code comments** state a constraint the code can't show; never where a finding came from. Review bookkeeping is noise the moment it merges.
- **Commit messages** describe what the change did and why. **The test is resolvability: every identifier, file and fact a message names must be findable by someone who has only this repository.** `agent-memory/` is excluded from this code repository, so a criterion id (`AC3`), a feature or backlog id (`F-099`, `BL-247`), or a path under `agent-memory/` resolves to nothing for that reader — state the substance instead of the pointer. Review bookkeeping fails the same test from the other side: reviewer names, finding counts, severities and iteration counts describe the conversation, not the work, and no file records them. What a message *may* name is anything the repository holds — a path, a symbol, a measured number, a behaviour a reader can go and check.
- **Skill/agent prose** may keep a terse provenance cite (`F-NNN`, `Plan NNN`, `BL-NNN` — see Internal terminology above); reviewer attribution goes.
- Nothing enforces this mechanically. It is a writing rule, checked by whoever reads the diff; functional cross-family references (proxy agents, track names, family selection) are not violations of it.

## Git

- **One feature, one branch, always.** Every feature works on a branch of its own, created where
  its work starts and named for it: `feature/F-NNN-<slug>`, or `feature/<slug>` / `fix/<slug>` for
  work that is not a feature. The review stage judges everything committed since the feature
  started, and a branch is what makes that range answerable — two features' commits on one branch
  turn it into guesswork. This part is never optional, worktree or not.
- **A worktree is for concurrency, not a default every feature owes.** Give a feature its own
  `git worktree` when something else could touch the same checkout while it runs — another
  feature, another session, a background process — and skip it when nothing will: the branch alone
  already answers "which commits are this feature's," and a worktree with nothing to isolate from
  is ceremony. **The working tree is shared, not per-session, exactly when more than one thing is
  using it** — that is the condition a worktree answers, not a property of every feature. Two
  sessions in one checkout do not merely risk each other's commits: one measures a file the other
  is rewriting, and both readings look normal. Observed, twice in one hour, in both directions. A
  lock held by a person is not the answer either — it was stale both times it was issued, because
  the interval between observing a quiet tree and writing to it belongs to whoever starts next. If
  there is any real chance of a second thing touching the tree — including a delegated stage whose
  own background writes could outlive its turn — take the worktree; the cost of one unneeded is far
  smaller than the cost of a collision nobody was watching for.
- **A feature committing without asking is about reach, not about worktrees.** Committing does not
  need permission because it reaches nobody else's work — true inside an isolating worktree, and
  equally true in the shared checkout when nothing else is using it at the time. A stage that has to
  stop for permission at every step cannot run unattended either way.
- **A feature merges back into the branch it was cut from, once it has passed acceptance** — the
  human's signature at the completion gate, not a green suite and not a pass verdict. Nothing else
  merges it, and it merges nowhere else: a branch cut from another feature's head goes back there,
  so the stack unwinds in the order it was built.
- Never push to remote unless explicitly approved by the user

## Design Principles

- **Self-bootstrapping, by running it rather than by processing it** — AE develops AE, and that stays the default working mode. What changed is where the evidence comes from. Putting every change through the AE pipeline and collecting findings is the loop that produced the bloat: a finding about behaviour is cheapest to discharge by writing a rule about it, nothing in that loop ever proposes deleting one, and every pass makes the next costlier while feeling like diligence. So the evidence now comes from **execution, observed**: change the thing, then have a session that did not write it run the affected stage from the file alone, with a second session watching and writing down what it actually did. See *Run before deciding* below for the mechanics.
  A finding from such a run is dispositioned by **changing or deleting the thing**, not by adding a rule beside it. A new rule has to name the one it replaces, or say why nothing it replaces existed.
  Bootstrapping is what makes this repository's edit loop unlike an ordinary project's: elsewhere you edit code that a test then runs, here you edit the instructions the running agent is made of. Two consequences, both silent when ignored — **within a session**, nothing reaches the agent until `/reload-plugins` (see *Run before deciding* below); **across sessions**, this repo loads the plugin from its own working tree (`.claude/settings.json`), so a new session reads the current files with no version bump, while a marketplace install anywhere else stays pinned to the version it was installed at until that version is bumped and the plugin updated.
- **Project-agnostic** — skills and agents read project context from CLAUDE.md
- **Extensible** — projects define their own roles as `.claude/agents/*.md`, which the host
  discovers; a project role is preferred over an AE one when both fit
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **A stage is defined by its handoffs** — what it produces, what the next stage takes, and who is responsible for putting it there. Most defects found in this workflow have been in that seam rather than in what a stage does: a file named in one stage and never declared an input of the next; an artifact a stage was told to quote and never told to read; a record whose items the following stage had no way to identify. When a stage changes, the question to ask is not only whether its own rules are right but whether the thing it hands over is still named, findable, and identifiable on the other side.
  Two shapes recur. **A handoff carries its own identity** — a stable token the receiving stage repeats, never a description it has to recognise; where identity is inferred, the seam leaks silently. **A handoff's boundary is structural, not a naming convention** — a stage's artifacts live under a directory named for the stage, so nothing has to be spelled correctly at N sites to keep two stages' files apart.

- **Run before deciding** — new skills or significant skill changes must be followed by at least one real execution before the next discussion or plan cycle. **The execution is closed-book: a fresh session, given the skill file and a work item and nothing else — no reminder of the rules it is meant to follow — while the session that made the change watches and records where it went wrong.** Same session is open-book and proves nothing; one run is an anecdote. What this catches is what no scan over the files catches: six such runs of the discuss stage produced five genuine defects and two rule ambiguities, against none from any check that read the same files. That execution needs `/reload-plugins` first: skill bodies and agent definitions are read once at session start, so `Skill` returns the old text and a new agent is `not found`, with no warning either way — the call succeeds and the content looks normal. **Reload is a snapshot, not a subscription:** it loads what is on disk at that instant, so every further edit needs its own reload. Two rounds of edits, two reloads.
  **This reaches the runner, not just you**, and the two halves behave differently — both measured, by asking runners to report exact strings whose presence on disk had been established first. A session spawned to run a stage receives a *snapshot* of the skill text taken at the **parent session's** start, never the file on disk — and `/reload-plugins` does **not** reach it: a subagent spawned after a reload still gets what its parent held when the parent opened. Measured three ways on the same markers: a session open since before the commits is stale, a subagent spawned after the reload is stale, and only a **newly opened top-level session** serves the current text. So a stage delegated to a subagent runs whatever its parent started with, and the way to exercise a changed skill is to open a new session or to hand the runner the file to read. It does **not** refresh CLAUDE.md, which stays frozen at session start with no in-session remedy — a change to this file needs a genuinely new session before any runner can see it. Miss either and the run silently exercises the previous version: it succeeds, and its output reads normally.

## Agent Definition Principles

- **No duplication** — if a concept is already in the agent definition, don't add it again with different wording
- **One-line rules** — prefer `- Rule summary` over multi-paragraph explanation
- **Test after changes** — any agent definition modification must be followed by running a real task to verify no regression
- **No self-check steps** — don't add "verify your output" instructions; they add hesitation without enforcement
- **Size awareness** — if an agent definition exceeds ~100 lines, review for bloat

## Further reading

- [docs/rebuild.md](docs/rebuild.md) — why AE was rebuilt, what the minimum is, and the roadmap
- [docs/quickstart.md](docs/quickstart.md) — getting started
- [docs/references/](docs/references/) — design rationale, plugin API, prompt patterns, AE↔CC contract surface

Contributors actively running the AE-on-AE workflow can additionally maintain a local-only `CLAUDE.local.md` for AE-internal process detail (project-management model, feature directory layout, frontmatter schemas, autonomy boundary). That file is gitignored and never ships.

## Code and agent-memory commits

`agent-memory/` is this project's independent Git repository for AE stage artifacts. The parent
code repository ignores it. `.ae` is a compatibility symlink to `agent-memory` for existing skills,
scripts, historical references, and already-running sessions; use `agent-memory/` for new paths.

Before every project code commit, inspect both repositories with `git status --short` and
`git -C agent-memory status --short`. Update the related AE artifacts, then commit the task's
memory changes in `agent-memory` and the code changes in the parent repository as one delivery.
Stage explicit task-owned paths in each; a parent `git add` / `git commit` never commits the nested
repository. Preserve other Agents' unrelated changes. If memory has no task-related changes,
report that it was checked and unchanged; do not create an empty commit.

Record both commit IDs in the delivery report. Git cannot atomically commit two repositories:
if either commit fails, report the partial state and finish the missing commit before declaring
completion. When pushing the delivery is authorized, push the memory commit and the code commit
to their respective upstream branches and verify both; do not claim both were pushed after only one
succeeds. Existing branch, review, merge, and deployment approval rules still apply.

In a new checkout or worktree, ensure `agent-memory` resolves to the intended independent repository
before writing; do not silently create an empty directory or assume another worktree's memory is
shared. Use the project Issue ID / Feature ID and AE handoff contracts to select relevant artifacts.
