# Project Management

- Repository: `ckai/agentic-engineering`
- Forgejo Project: `Agentic Engineering Work`
- Project URL: `/ckai/agentic-engineering/projects/2`
- Local working set: `project-work.md`
- Columns: `Backlog`, `Ready`, `In Progress`, `Blocked`, `Done`

For tracked work, use `forgejo:create`, `forgejo:update`, `forgejo:start`,
`forgejo:block`, or `forgejo:close` as appropriate. `forgejo:manage` is a compatibility router.

Run `forgejo:sync` on tracked-work session entry, before selecting or mutating Issues,
and after changes. Forgejo Issues are authoritative; `project-work.md` is a historical
snapshot, and the Project board is a bounded projection. Local display order is not priority.
If live refresh fails, preserve the previous snapshot and mark it stale; stop dependent
selection or mutations. Report local snapshot and board synchronization separately.
