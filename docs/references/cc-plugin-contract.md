# Claude Code Plugin Contract — AE Dependencies + Mitigations

Source: Discussion 054 topic-03 (2026-05-20).

This document enumerates AE plugin's dependencies on Claude Code (CC) harness primitives and the mitigation path for each if the dependency changes or breaks. It is the **canonical reference** for AE↔CC contract surface during v0.10.x; downstream skills (e.g., future `ae:next` pre-flight checks, `ae:setup` validation) consume this list when reasoning about CC capability requirements.

## Failure class taxonomy (4 tiers)

Every dependency below is classified into one of four failure modes. The class determines `/ae:review` severity triage when an undocumented dependency is detected (see Update protocol at end of this document).

| Class | Behavior on dep removal/change | User signal | Example |
|-------|-------------------------------|-------------|---------|
| `hard` | AE cannot run | Visible breakage; immediate | `Agent` subagent mechanism |
| `silent-degrade` | AE keeps running; perf/feature degrades | None — user has no signal | `run_in_background` removal → 4-6× throughput drop |
| `fast-fail` | AE install/start reports clear error | Visible; user self-diagnoses | `CLAUDE_PLUGIN_ROOT` rename |
| `empirical` | AE works today, no contractual guarantee | Requires periodic re-verification | `plugin.json hooks` block auto-registration |

**Highest severity for undocumented**: `silent-degrade` — user does not know AE has degraded.

## Live dependencies (9)

| # | Dependency | Failure class | Used by | Mitigation |
|---|------------|---------------|---------|------------|
| 1 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var | `silent-degrade` | All multi-agent skills (`ae:plan`, `ae:work`, `ae:review`, `ae:discuss`, `ae:analyze`, `ae:code-review`, `ae:consensus`, `ae:team`, `ae:test-plugin`) | Each skill's Pre-check auto-falls back to solo mode and prints `[WARNING] Agent Teams unavailable, running solo`. Cross-family and parallel review are disabled in this path. |
| 2 | `run_in_background: true` Agent param (experimental) | `silent-degrade` | 9 skills with multi-agent spawn; spawns 4–6 parallel agents per skill | If removed: grep-replace `Agent(...run_in_background: true,...)` across `plugins/ae/skills/` to drop the param; foreground Agent calls serialize execution. **Performance impact**: `/ae:review` synthesis ~30 s → ~2 min (≈ 4–6× slowdown). Must surface a user-visible warning on detection — silent degradation is the worst failure mode. |
| 3 | `TeamCreate` / `SendMessage` / `TeamDelete` MCP tools (CC-private) | `silent-degrade` | All Agent Teams spawning skills | Graceful degrade to solo mode through the same Pre-check path as #1 (no separate fallback needed). |
| 4 | `Agent` subagent mechanism | `hard` | Foundational across the plugin — every skill that delegates to a subagent | AE cannot function without `Agent`. No fallback. Documented as a hard dependency; CC removal of this primitive would terminate AE as a viable plugin. |
| 5 | Hook events (`SessionStart` + `SessionEnd`) | `empirical` | `plugin.json` registers `scripts/check-cross-family.sh` (SessionStart) and `scripts/trace-rotate.sh` (SessionEnd) | Empirically verified registering today via plugin.json `hooks` block (see BL-023 closure evidence section below). If deprecated: fall back to user-wired `~/.claude/settings.json` hooks. **Scope note**: settings.json hooks are **per-user-global**, NOT per-plugin-per-user — users must manually edit + re-sync across machines (acceptable degradation path, not equivalent to plugin-managed hooks). Alternative hook events also documented as fallback surface per Discussion 054 Doodlestein-adversarial Round 2: `PostToolUse` / `UserPromptSubmit` (not currently used but available if `SessionStart` / `SessionEnd` are deprecated). |
| 6 | `plugin.json` `hooks` block auto-registration | `empirical` | Plugin-level hook installation without manual `~/.claude/settings.json` editing | BL-023 historical concern (see closure evidence below). Empirical observation only — verified for CC version at ship time 2026-05-20; **NOT a contractual commitment** that future CC versions will preserve `plugin.json hooks` semantics. Re-verify on each CC major version bump. If `plugin.json hooks` auto-registration is dropped, fall back to manual settings.json wiring (see #5). |
| 7 | `userConfig` mechanism (plugin.json `userConfig` block) | `silent-degrade` | Gemini MCP server model selection — `gemini_flash_model` / `gemini_pro_model` map to `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL` / `CLAUDE_PLUGIN_OPTION_GEMINI_PRO_MODEL` env vars at MCP startup | If removed: hard-code default models in `plugins/ae/mcp-servers/gemini/src/index.ts`, lose user customization. Acceptable degradation (default models still work). |
| 8 | `mcpServers.*.env` passthrough (plugin.json `mcpServers.gemini.env`) | `silent-degrade` | Gemini MCP server credential binding — `"env": {"GEMINI_API_KEY": "${GEMINI_API_KEY}"}` block injects host env var into the MCP server process at startup | If removed: require user to export `GEMINI_API_KEY` directly to the shell that spawns CC (lose declarative env binding); document migration in plugin-level CLAUDE.md. Silent failure mode: MCP server starts but Gemini API auth fails → user sees `gemini-proxy unavailable` messages with no clear cause. |
| 9 | `CLAUDE_PLUGIN_ROOT` env var | `fast-fail` | plugin.json `mcpServers.gemini.command` uses `cd "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini"` to locate the bundled MCP server before `npm install` + `node dist/index.js` | If renamed: plugin install fails fast with a visible "command not found" / "no such directory" error. User can self-diagnose and patch plugin.json. Low-severity failure mode. |

## BL-023 closure evidence

BL-023 (`hooks.json / plugin.json registration gap`) was historically open because the CC plugin system's auto-discovery of `hooks.json` and `plugin.json hooks` blocks was uncertain. Empirical verification during T1 (Plan 054 NDJSON trace) ship on 2026-05-20 confirms `plugin.json hooks` block auto-registers and fires on SessionStart.

Verbatim from T1 review (verdict: pass):

> ```
> ts=2026-05-20T21:45:15Z
> CLAUDE_CODE_SESSION_ID=aecd9dda-aa24-4e14-b612-809e7aa9388f
> CC_SESSION_ID=MISSING
> AE_SESSION_ID=MISSING
> agent_teams=true codex=true gemini=true
> ```
>
> Conclusion:
> - **BL-023 hook 真注册生效** ✅ (entry exists, hook fired on SessionStart)
> - **CLAUDE_CODE_SESSION_ID 暴露** ✅ (non-MISSING value)
> - **T1 trace filename=session_id join key reliable** ✅ (session_id_source=explicit, no fallback to uuidgen)
> - **SessionEnd hook → trace-rotate.sh 同 hooks block 机制** → equivalently verified (same plugin.json hooks registration path)

Source pointer for traceability (NOT for evidence — `.ae/` files are gitignored and mutable): `.ae/reviews/054-t1-trace-ndjson-instrument.md`. The verbatim block above is the canonical evidence; the source pointer is informational only.

**Scope note**: BL-023's original action #4 (`.ae/backlog/done/v0.8.1/BL-023-hooks-plugin-registration.md`) requested "Verify with a **fresh plugin install**." The T1 evidence above demonstrates `SessionStart` hook firing within an active CC session that already had AE plugin loaded — same `plugin.json hooks` block mechanism, but not a cold fresh-install path. The closure narrows BL-023's acceptance to "plugin.json hooks block fires for an installed plugin" (the observable that the original BL effectively cared about). A formal cold-install smoke test is **not** in T3 scope; if cold-install pathology is ever observed, re-open BL-023 with a dedicated test fixture.

**Re-verification cadence**: each CC major version bump (or when SessionStart hook stops firing observably). Update this section's verbatim block + the `Re-verified:` line below on each re-verification pass.

Re-verified: 2026-05-20 (initial verification at T1 ship).

## MCP servers — distribution policy

The Gemini MCP server (`plugins/ae/mcp-servers/gemini/`) uses a **dist/-committed** distribution policy:

- Build output `dist/*.js` is committed to git (`.gitignore` line 6 confirms: `# dist/ — committed for plugin distribution (no build step on install)`).
- Runtime install (per `plugin.json` `mcpServers.gemini.command`): `cd "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini" && npm install --omit=dev --silent >&2 && exec node dist/index.js`. Production deps install at MCP startup; TypeScript (devDependency) is never installed at install time.

**Rationale**: keeps install-time fast and free of TypeScript build steps; users get a working MCP server immediately after plugin install. Tradeoff is contributor discipline: dist/src drift is a human-maintained invariant (no current CI check).

### Contributor workflow

After editing `plugins/ae/mcp-servers/gemini/src/**`:

1. Run `cd plugins/ae/mcp-servers/gemini && npm run build`.
2. Commit the resulting `dist/` changes **in the same PR / commit** as the `src/` edit.

If you forget to rebuild + commit `dist/`, the change ships with stale build output. A `prepublishOnly` guard in `package.json` will catch this **only if** the repo ever adopts an `npm publish` workflow; until then, dist/src drift is a human-discipline contract enforced at code-review time.

### Build & runtime command reference

```sh
# Build (contributor, after src/ edits):
cd plugins/ae/mcp-servers/gemini
npm run build       # → tsc; writes dist/*.js + dist/*.d.ts

# Runtime startup (handled automatically by plugin.json mcpServers.gemini.command):
cd plugins/ae/mcp-servers/gemini
npm install --omit=dev --silent >&2
node dist/index.js
```

CI reproducibility check (`git diff --exit-code -- dist/` after clean rebuild) is deferred to v0.11.x schema discipline expansion — same deferral bucket as the cc-plugin-contract.md drift validator below.

## Decommissioned dependencies (historical)

Dependencies AE no longer relies on, preserved here for archaeology:

- **`@include` directive in skill markdown** — previously used by `ae:agent-teams` cast block resolution to pull in shared protocol fragments. Decoupled in 2026-04 (Doodlestein-regret challenge during the v0.9.x cycle): content is now inlined into each consuming SKILL.md. No current dependency on `@include`; listed here only so future archaeology need not re-derive that this WAS once a dependency.

## Format reversal note

This document uses Markdown as the canonical format for v0.10.x. Markdown is human-optimized and unsuitable for programmatic consumption.

**Reversal trigger**: when v0.11.x introduces a programmatic consumer (e.g., `ae:next` pre-flight CC capability check, `ae:setup` validation, or `ae:review` automated drift detection), the canonical form rotates to YAML/JSON at `docs/references/cc-plugin-contract.yaml` with this `.md` regenerated as a derived view. The 9-row 4-column table structure (Dependency | Failure class | Used by | Mitigation) is designed to translate cleanly into a YAML schema; rotation cost is `wc -l` × manual transcription (manageable for 9 rows; ≤ 1 contributor-hour). The decision to rotate is **deferred until first downstream consumer exists** — premature YAML now would build infrastructure with no caller.

If you are reading this document and about to add a programmatic consumer, this is the trigger. Open a backlog item to rotate the canonical form.

## Update protocol

When AE adds a new CC dependency, append a row to the **Live dependencies** table above with `Failure class` AND a mitigation entry.

**Trigger**: `/ae:review` reviewer (architect or codex-proxy) must check `git diff` for any of:

- changes in `plugins/ae/.claude-plugin/plugin.json` (new field, new MCP server config, new hooks block)
- new `${...}` env var usage in plugin code (e.g., `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_CODE_EXPERIMENTAL_*}`)
- new MCP tool calls in skills/agents (e.g., new `Team*` / `Subagent*` invocations beyond the current 9-tool surface)

If a new CC dependency surface is detected and not yet documented here, raise a finding.

**Severity triage based on failure-class** (the new row's class determines the finding severity):

| Class of undocumented dep | Finding severity |
|---------------------------|------------------|
| `silent-degrade` | **P1** — user invisible breakage; highest priority |
| `hard` | **P2** — visible breakage but user can self-diagnose |
| `empirical` | **P2** — works today but missing re-verification cadence |
| `fast-fail` | **P3** — auto-discoverable on next install |

CI grep validation of this document (machine-readable drift detection between dep enumeration here vs actual codebase usage) is deferred to v0.11.x schema discipline expansion. Until then, manual update via the reviewer trigger above is the contract.
