# P0.G-lite feasibility spikes

These programs answer only whether one implementation direction is plausible on
`macos-26.6.2-arm64-cc-2.1.231-plugin-dir`. They are unregistered test code,
emit no capability, and are not P0.8 qualification results.

## Candidate paths

- Active release: correlate the exact CC system-init `plugins[]` row and session
  ID with the launch's single `--plugin-dir`, then hash the selected root's
  manifest. The smoke rejects A/B old-root selection, env-only input, duplicate
  rows, stale sessions, caller roots, and manifest drift. A real CC 2.1.231
  system-init record captured during P0.0 demonstrated that the host emits
  session-correlated plugin name/path/source/version for this arm.
- Child isolation: runner-owned `sandbox-exec` denies sibling writes and
  loopback network, receives a literal environment allowlist, and combines with
  a runner-owned process group so timeout cleanup kills descendants.
- Filesystem: Darwin `renamex_np(RENAME_EXCL)` separately moves complete files
  and directories, gives one winner in same-filesystem races, preserves an
  existing target, retains the losing source, verifies payload integrity, and
  fsyncs source and target parents.

## Deferred risk matrix

P0.7/P0.8 still must test installed-plugin update, old cache, old session,
reload, fresh session, interactive/`-p`/SDK, direct core import, fake/replayed
capability, and host record provenance. Isolation still needs the full
filesystem/network/process-descendant/output-root matrix and exact provider
build selector. Filesystem still needs filesystem/mount capability selectors,
cross-device behavior, fault injection, crash/power-loss durability, and an
immutable helper build. None of those claims is inferred from these smokes.
