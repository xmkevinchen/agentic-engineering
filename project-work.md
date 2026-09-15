# Project Work

<!-- BEGIN MANAGED: forgejo-work -->
Repository: `ckai/agentic-engineering`
Snapshot status: observed
Last successful fetch: 2026-09-15T22:24:00Z
Last attempt: 2026-09-15T22:24:00Z

Historical snapshot only. Refresh live before selection or mutation.
Next is a candidate set; display order is not priority.

## Current

None.

## Next

None.

## Blocked

None.

Unclassified open Issues: none.

## Board Sync

Status: pending
Board not checked in this refresh.
<!-- END MANAGED: forgejo-work -->

## Backlog (remote-authoritative, not kept in sync by the writer above)

By design, the sync writer's managed block above never lists `workflow/backlog` issues —
"Backlog stays remote." This section is a manual, unmanaged convenience listing as of
2026-09-15; re-run `/forgejo:sync` and re-copy by hand if it goes stale, or just read Forgejo
directly. All 6 remaining open issues carry only the `workflow/backlog` label — none is
`ready`.

- #27 — A host-level hook could verify a seat called its backend, instead of trusting the
  seat's own word (idea)
- #26 — A stage reading untrusted input runs in the same context as both human gates (known gap)
- #16 — 拿 codex-plugin-cc 的运行时跟我们自己的 seat 路径逐条比 (prior-art comparison, marked
  不急/not urgent)
- #15 — plan → work → review 的 ReAct loop 强化 (idea; depends on closed-book runs of
  plan/work/review first)
- #12 — Monitoring a background stage: what worked, what broke, and the rule that would have
  caught all three breaks (process finding; blocked by #8)
- #8 — 主控是一个角色，但 AE 只写了它的过程——把角色和它的物理边界写进 go/SKILL.md (gap in the
  entry; blocks #12 and any stage-isolation/parallelism discussion; a prior attempt, `F-113`,
  reached REVIEW `pass` and was rejected at human sign-off — see
  `agent-memory/features/abandoned/F-113-controller-role-in-go-skill/retrospective.md`)

## Preserved pre-sync content (historical)

# Project Work

Forgejo: `ckai/agentic-engineering`
Project: `Agentic Engineering Work`
Last synced: 2026-09-11

This file is a local navigation cache. Forgejo remains authoritative.

## Current

- #33 — Fix `review` and `work` skill frontmatter parsing

## Next

These are the dependency-ready entries in the highest active README priority group. Their order
relative to one another is not yet decided.

- #9 — Decide how the doodlestein close-out round is implemented
- #11 — Overhaul the four close-out readers
- #24 — Make REVIEW's fresh-eyes rule structural; unlocks #25

## Blocked

- #5 — Update agent definitions for the current host; blocked by #9
- #25 — Add loaders to shipped agent definitions; blocked by #24
