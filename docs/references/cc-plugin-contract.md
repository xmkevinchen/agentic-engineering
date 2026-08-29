# Claude Code Plugin Contract — AE Dependencies + Mitigations

Source: Discussion 054 topic-03 (2026-05-20).

This document enumerates AE plugin's dependencies on Claude Code (CC) harness primitives and the mitigation path for each if the dependency changes or breaks. It is the **canonical reference** for the AE↔CC contract surface: anything reasoning about which CC capabilities AE requires reads this list.

## Failure class taxonomy (4 tiers)

Every dependency below is classified into one of four failure modes. The class determines `/ae:review` severity triage when an undocumented dependency is detected (see Update protocol at end of this document).

| Class | Behavior on dep removal/change | User signal | Example |
|-------|-------------------------------|-------------|---------|
| `hard` | AE cannot run | Visible breakage; immediate | `Agent` subagent mechanism |
| `silent-degrade` | AE keeps running; perf/feature degrades | None — user has no signal | `run_in_background` removal → 4-6× throughput drop |
| `fast-fail` | AE install/start reports clear error | Visible; user self-diagnoses | `CLAUDE_PLUGIN_ROOT` rename |
| `empirical` | AE works today, no contractual guarantee | Requires periodic re-verification | `plugin.json hooks` block auto-registration |

**Industry cross-reference**: `hard` + `fast-fail` together correspond to AWS Well-Architected REL05-BP01's **hard dependency** (failure = outage); `silent-degrade` corresponds to AWS's **soft dependency** (failure = degradation). `empirical` is a **risk class** (no contractual guarantee — verification cadence substitutes), not a stable operational class — AWS WAF has no direct equivalent. The 4-tier model is finer-grained than AWS's 2-tier model, appropriate for AE's heterogeneous CC dependency surface.

**Highest severity for undocumented**: `silent-degrade` (user does not know AE has degraded) and `hard` (AE is down). Both classes warrant P1 finding in `/ae:review`; the gradient at P2/P3 below them reflects diagnosability.

## Live dependencies (9)

| # | Dependency | Failure class | Used by | Mitigation |
|---|------------|---------------|---------|------------|
| 1 | `Agent` subagent mechanism | `hard` | Foundational across the plugin — every skill that delegates to a subagent | AE cannot function without `Agent`. No fallback. Documented as a hard dependency; CC removal of this primitive would terminate AE as a viable plugin. |
| 2 | Hook events (`SessionStart`) | `empirical` (re-verified: 2026-05-20, CC version at T1 ship) | `plugin.json` registers `scripts/check-cross-family.sh` (SessionStart) | Empirically verified registering today via plugin.json `hooks` block (see BL-023 closure evidence section below). If deprecated: fall back to user-wired `~/.claude/settings.json` hooks. **Scope note**: settings.json hooks are **per-user-global**, NOT per-plugin-per-user — users must manually edit + re-sync across machines (acceptable degradation path, not equivalent to plugin-managed hooks). Alternative hook events available as fallback surface if `SessionStart` is deprecated: `PostToolUse` / `UserPromptSubmit`. |
| 3 | `plugin.json` `hooks` block auto-registration | `empirical` (re-verified: 2026-05-20, CC version at T1 ship) | Plugin-level hook installation without manual `~/.claude/settings.json` editing | BL-023 historical concern (see closure evidence below). Empirical observation only — verified for CC version at ship time 2026-05-20; **NOT a contractual commitment** that future CC versions will preserve `plugin.json hooks` semantics. Re-verify on each CC major version bump. If `plugin.json hooks` auto-registration is dropped, fall back to manual settings.json wiring (see #5). |
| 4 | `userConfig` mechanism (plugin.json `userConfig` block) | `silent-degrade` | Gemini MCP server model selection — `gemini_flash_model` / `gemini_pro_model` are *intended* to map to `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL` / `CLAUDE_PLUGIN_OPTION_GEMINI_PRO_MODEL` at MCP startup. **Measured 2026-08-16 (F-082): an option the user never configured exports nothing, even though `plugin.json` declares a default for it.** Both variables are unset and the server runs on its own hardcoded fallbacks; whether a *configured* option materialises is untested. So the `silent-degrade` classification is right for the wrong reason — it degrades because the variable never arrives, not because the option is optional. | If removed: hard-code default models in `plugins/ae/mcp-servers/gemini/src/index.ts`, lose user customization. Acceptable degradation (default models still work — that is in fact the current state). **Do not reference a `${CLAUDE_PLUGIN_OPTION_*}` from a manifest `env` block**: those are validated at install time and an unresolved one rejects the whole server, so a declared-only default takes the server down instead of supplying its value. Read the option in-process with a fallback, as both bundled servers now do. |
| 5 | `mcpServers.*.env` passthrough (plugin.json `mcpServers.gemini.env`) | `silent-degrade` (becomes `fast-fail` on first MCP call when env unbound) | Gemini MCP server credential binding — `"env": {"GEMINI_API_KEY": "${GEMINI_API_KEY}"}` block injects host env var into the MCP server process at startup | If removed: require user to export `GEMINI_API_KEY` directly to the shell that spawns CC (lose declarative env binding); document migration in plugin-level CLAUDE.md. Two-stage failure: declarative bind silently fails at MCP startup (no user signal); first MCP call surfaces `gemini-proxy unavailable` error (visible). |
| 6 | `CLAUDE_PLUGIN_ROOT` env var | `fast-fail` | plugin.json `mcpServers.gemini.command` uses `${CLAUDE_PLUGIN_ROOT}` to locate the committed bundle it execs directly (`node "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini/dist/index.mjs"`) | If renamed: plugin install fails fast with a visible "command not found" / "no such directory" error. User can self-diagnose and patch plugin.json. Low-severity failure mode. |
| 7 | `outputStyles` plugin.json field | `silent-degrade` | `plugins/ae/.claude-plugin/plugin.json:33` registers `output-styles/ae-structured.md` and `output-styles/ae-compact.md` as user-selectable output style options | If removed: registered output style names disappear from `/output-style` menu; user falls back to CC's default styles. No skill breakage (output styles are presentation-layer only). Mitigation: vendor styles into project-level `.claude/output-styles/` per user if AE-level registration breaks. |
| 8 | Plugin agent namespace prefix (`ae:` resolution) | `hard` | All 18 built-in agents in `plugins/ae/agents/{review,research,workflow,engineering}/` rely on CC resolving plugin agent IDs with `ae:` namespace prefix (e.g., `ae:review:architecture-reviewer`) for collision avoidance with project agents | If removed: agent name collisions with user's `.claude/agents/` cannot be deterministically resolved; AE built-in agents become unaddressable via `subagent_type:`. No fallback short of bundling AE as a non-plugin (deep refactor). Hard dependency on CC plugin-agent namespace resolution. |
| 9 | `ToolSearch` (deferred-tool schema lookup) | `silent-degrade` (fail-open) | Proxy agents fetch their own deferred backend tools before acting (`codex-proxy`, `gemini-proxy`, `openai-compat-proxy`) | If `ToolSearch` is unavailable, a proxy cannot load its backend tools and takes the unavailable path — it reports and stops rather than answering from its own reasoning. Visible, not silent: the run loses that family's coverage and says so. |

## Hook enforcement and design surface

Moved to [`hooks.md`](hooks.md) — the consolidated hooks reference: the measured
enforcement table (CC 2.1.247), the official-semantics cross-check, the Codex
convergence table, the standing design rules, and the workflow's minimal hook
set. Dependencies #2/#3 above cover only *registration*; `hooks.md` is the
authority on *what a firing hook can do*.

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

Source pointer for traceability (NOT for evidence — `.ae/` files are gitignored and mutable): `.ae/reviews/054-t1-trace-ndjson-instrument.md`. The verbatim block above is the canonical evidence; the source pointer is informational only.

**Scope note**: BL-023's original action #4 (`.ae/backlog/done/v0.8.1/BL-023-hooks-plugin-registration.md`) requested "Verify with a **fresh plugin install**." The T1 evidence above demonstrates `SessionStart` hook firing within an active CC session that already had AE plugin loaded — same `plugin.json hooks` block mechanism, but not a cold fresh-install path. The closure narrows BL-023's acceptance to "plugin.json hooks block fires for an installed plugin" (the observable that the original BL effectively cared about). A formal cold-install smoke test is **not** in T3 scope; if cold-install pathology is ever observed, re-open BL-023 with a dedicated test fixture.

**Re-verification cadence**: each CC major version bump (or when SessionStart hook stops firing observably). Update this section's verbatim block + the `Re-verified:` line below on each re-verification pass. **No automated detection mechanism exists in AE v0.10.x** — re-verification is a human-discipline contract; missed cadence does not auto-page. Detection automation is deferred to v0.11.x schema discipline expansion (consistent with `cc-plugin-contract.md` drift CI deferral).

Re-verified: 2026-05-20 (initial verification at T1 ship; CC version at ship time — see plugin.json metadata in T1 ship commits / capture future re-verify with `claude --version` output appended here on each pass).

## MCP servers — distribution policy

The Gemini MCP server (`plugins/ae/mcp-servers/gemini/`) uses a **dist/-committed** distribution policy:

- Build output `dist/index.mjs` is committed to git — a single self-contained esbuild bundle with every production dependency inlined (`.gitignore` line 6 confirms: `# dist/ — committed for plugin distribution (no build step on install)`).
- Runtime startup (per `plugin.json` `mcpServers.gemini.command` — the single declaration since F-082 removed the duplicate `plugins/ae/.mcp.json`; the reference documents the two locations as alternatives and leaves the same-name collision case undefined): `exec node "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini/dist/index.mjs"`. **Nothing installs at startup.** There is no `npm install` on the session path and no `cd` — the `.mjs` extension makes the bundle self-describing as ESM, so it no longer depends on being run from a directory whose `package.json` declares `"type": "module"`.

**Rationale**: the previous shape ran `npm install --omit=dev` on *every* session start. That cost a package resolution per launch, made Node a hard startup dependency of an optional component, and could rewrite a user's cached lockfile with no signal (it ran `install`, not `ci`). It also failed hard on a host with no Node at all. Tradeoff is unchanged in kind: dist/src drift is a human-maintained invariant (no current CI check) — but see the widened trigger below, because bundling makes the drift window larger.

### Contributor workflow

After editing `plugins/ae/mcp-servers/gemini/src/**`, **or `package.json`, or `package-lock.json`**:

1. Run `cd plugins/ae/mcp-servers/gemini && npm run build` (typecheck + bundle).
2. Commit the resulting `dist/index.mjs` **in the same PR / commit** as the edit.

**Reviewing a bundle change.** `dist/index.mjs` is ~2.1 MB of inlined dependency code and is not reviewable by eye — do not try. **Review `package.json` and `package-lock.json` instead**: those carry the dependency and integrity-hash changes that a bundle diff only reflects. A malicious or compromised dependency is visible there and invisible in the bundle diff. This is a net improvement on the previous shape, where `npm install --omit=dev` resolved semver ranges against whatever the registry served at that moment — an unreviewed resolution per session, with zero bytes in git to diff at all. The bytes that execute are now pinned in history; the reviewable surface is the manifest pair.

**Why dependency changes now trigger a rebuild too.** Before bundling, a dependency bump with no `src/` change still reached users: the runtime `npm install` picked it up at their next session start. Now nothing installs at runtime, so a bumped dependency reaches nobody until someone rebuilds the bundle — a dormant documentation gap turned into a live shipping defect. `src/**` alone is no longer a sufficient trigger.

If you forget to rebuild + commit `dist/`, the change ships with stale build output. A `prepublishOnly` guard in `package.json` will catch this **only if** the repo ever adopts an `npm publish` workflow; until then, dist/src drift is a human-discipline contract enforced at code-review time.

### Build & runtime command reference

```sh
# Build (contributor, after src/, package.json or package-lock.json edits):
cd plugins/ae/mcp-servers/gemini
npm run build       # → tsc --noEmit (typecheck) then esbuild; writes dist/index.mjs

# Runtime startup (handled automatically by plugin.json mcpServers.gemini.command):
node "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini/dist/index.mjs"
# No install, no cd. Requires only a Node runtime on PATH.
```

CI reproducibility check (`git diff --exit-code -- dist/` after clean rebuild) is deferred to v0.11.x schema discipline expansion — same deferral bucket as the cc-plugin-contract.md drift validator below.

### Harness toolchain scripts (the green-loop layer)

Deterministic shell scripts under `plugins/ae/scripts/` (no CC-platform dependency beyond `sh`/`awk`/`jq`; each is exercised by `ae-run-tests.sh`):

| Script | Role |
|---|---|
| `verify-contract.sh` | jq-assertion runner for `verify_by: contract` ACs (exit 0 = all pass) |

## Decommissioned dependencies (historical)

Dependencies AE no longer relies on, preserved here for archaeology:

- **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, `TeamCreate` / `SendMessage` / `TeamDelete`, `Task*`, and `run_in_background: true`** — the Agent Teams surface. The stage skills spawn ordinary subagents and synthesize in the session; no skill creates a team, so none of these is load-bearing any more. The proxy agents still carry team-era wording in places, which is a documentation debt rather than a live dependency.
- **`@include` directive in skill markdown** — previously used by `ae:agent-teams` cast block resolution to pull in shared protocol fragments. Decoupled in 2026-04 (a v0.9.x-cycle design challenge): content is now inlined into each consuming SKILL.md. No current dependency on `@include`; listed here only so future archaeology need not re-derive that this WAS once a dependency.

## Format reversal note

This document uses Markdown as the canonical format for v0.10.x. Markdown is human-optimized and unsuitable for programmatic consumption.

**Reversal trigger** (explicit, enforceable): when ANY of the following lands in a single PR/plan:

1. A skill or agent reads `cc-plugin-contract.md` programmatically (regex, JSON parsing, structured field access).
2. A consumer claims the dependency table as a parseable contract (any code that depends on the table structure rather than human-readable content).
3. A v0.11.x schema discipline change introduces CI grep drift detection against this document.

→ The PR/plan landing the consumer MUST rotate canonical form to YAML at `docs/references/cc-plugin-contract.yaml` in the same PR, and update this document's pointer to "Canonical form: cc-plugin-contract.yaml; this `.md` is a derived/human-readable view." The 12-row 4-column table structure (Dependency | Failure class | Used by | Mitigation) is designed to translate cleanly into a YAML schema; rotation cost is manual transcription (manageable for 12 rows; ≤ 1 contributor-hour). The decision to rotate is **deferred until first downstream consumer exists** — premature YAML now would build infrastructure with no caller.

If you are reading this document and about to add a programmatic consumer, this is the trigger. Do NOT add the consumer without also rotating the canonical form in the same PR (or filing a backlog item with explicit dependency for a follow-up PR before the consumer ships).

## Update protocol

When AE adds a new CC dependency, append a row to the **Live dependencies** table above with `Failure class` AND a mitigation entry.

**Writer-side trigger** (when AE adds a new CC dependency): `/ae:review` reviewer (architect or codex-proxy) must check `git diff` for any of:

- changes in `plugins/ae/.claude-plugin/plugin.json` (new field, new MCP server config, new hooks block)
- new `${...}` env var usage in plugin code (e.g., `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_CODE_EXPERIMENTAL_*}`)
- new MCP tool calls in skills/agents (e.g., new `Team*` / `Task*` / `Subagent*` invocations beyond the current 12-tool surface)
- new CC env var reads in skill SKILL.md or agent .md prose text (e.g., new `CLAUDE_CODE_*` env var name appearing in instructions)

If a new CC dependency surface is detected and not yet documented here, raise a finding.

**Reader-side trigger** (when CC changes a dep AE already uses): monitor CC release notes at https://github.com/anthropics/claude-code/releases on each CC release. Flag any change to `plugin.json` fields used by AE (current set: `name`, `version`, `commands`, `skills`, `agents`, `mcpServers`, `hooks`, `outputStyles`, `userConfig`, `dependencies`), MCP tool naming conventions (`TeamCreate`, `Task*`, etc.), experimental env vars (`CLAUDE_CODE_EXPERIMENTAL_*`), or `Agent` API parameter set. Automated detection is deferred to v0.11.x (BL candidate).

**Empirical-class deps require last-verified annotation**: rows classified as `empirical` MUST carry an inline `(re-verified: YYYY-MM-DD, CC version: <X>)` annotation in the Failure class cell (see rows 5 + 6 above as the reference pattern). When re-verifying, update the inline annotation in the table cell AND the corresponding BL evidence section.

**Severity triage based on failure-class** (the new row's class determines the finding severity):

| Class of undocumented dep | Finding severity |
|---------------------------|------------------|
| `silent-degrade` | **P1** — user invisible breakage; highest priority |
| `hard` | **P1** — AE down (outage-class); equally high priority |
| `empirical` | **P2** — works today but missing re-verification cadence |
| `fast-fail` | **P3** — auto-discoverable on next install |

CI grep validation of this document (machine-readable drift detection between dep enumeration here vs actual codebase usage) is deferred to v0.11.x schema discipline expansion. Until then, manual update via the reviewer trigger above is the contract.

**Observability gap (v0.10.x known limit)**: this document is a contract artifact without an active observability surface — no error budget per class, no alerting on cadence miss, no automated drift detection. Acceptable for self-use scope; downstream consumers (e.g., AE-on-AE self-review) should be aware that the contract's authority is human-discipline-enforced, not machine-verified. Reliability / observability hook addition is deferred to v0.11.x.
