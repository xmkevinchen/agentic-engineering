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

**Industry cross-reference**: `hard` + `fast-fail` together correspond to AWS Well-Architected REL05-BP01's **hard dependency** (failure = outage); `silent-degrade` corresponds to AWS's **soft dependency** (failure = degradation). `empirical` is a **risk class** (no contractual guarantee — verification cadence substitutes), not a stable operational class — AWS WAF has no direct equivalent. The 4-tier model is finer-grained than AWS's 2-tier model, appropriate for AE's heterogeneous CC dependency surface.

**Highest severity for undocumented**: `silent-degrade` (user does not know AE has degraded) and `hard` (AE is down). Both classes warrant P1 finding in `/ae:review`; the gradient at P2/P3 below them reflects diagnosability.

## Live dependencies (12)

| # | Dependency | Failure class | Used by | Mitigation |
|---|------------|---------------|---------|------------|
| 1 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var | `silent-degrade` | All multi-agent skills (`ae:plan`, `ae:work`, `ae:review`, `ae:discuss`, `ae:analyze`, `ae:code-review`, `ae:consensus`, `ae:team`, `ae:test-plugin`) | Each skill's Pre-check auto-falls back to solo mode and prints `[WARNING] Agent Teams unavailable, running solo`. Cross-family and parallel review are disabled in this path. |
| 2 | `run_in_background: true` Agent param (experimental) | `silent-degrade` | 9 skills with multi-agent spawn; spawns 4–6 parallel agents per skill | If removed: grep-replace `Agent(...run_in_background: true,...)` across `plugins/ae/skills/` to drop the param; foreground Agent calls serialize execution. **Performance impact**: `/ae:review` synthesis ~30 s → ~2 min (≈ 4–6× slowdown). Must surface a user-visible warning on detection — silent degradation is the worst failure mode. |
| 3 | `TeamCreate` / `SendMessage` / `TeamDelete` / `Task*` (`TaskCreate` / `TaskGet` / `TaskList` / `TaskUpdate`) MCP tools (CC-private) | `silent-degrade` | All Agent Teams spawning skills (19+ skill/agent files reference Task* for in-team progress tracking) | Graceful degrade to solo mode through the same Pre-check path as #1 (no separate fallback needed). Task* failure mode: agent teams still spawn (Team* works) but task-tracking panel is empty; functionally equivalent to running with `TaskList` disabled. |
| 4 | `Agent` subagent mechanism | `hard` | Foundational across the plugin — every skill that delegates to a subagent | AE cannot function without `Agent`. No fallback. Documented as a hard dependency; CC removal of this primitive would terminate AE as a viable plugin. |
| 5 | Hook events (`SessionStart` + `SessionEnd`) | `empirical` (re-verified: 2026-05-20, CC version at T1 ship) | `plugin.json` registers `scripts/check-cross-family.sh` (SessionStart) and `scripts/trace-rotate.sh` (SessionEnd) | Empirically verified registering today via plugin.json `hooks` block (see BL-023 closure evidence section below). If deprecated: fall back to user-wired `~/.claude/settings.json` hooks. **Scope note**: settings.json hooks are **per-user-global**, NOT per-plugin-per-user — users must manually edit + re-sync across machines (acceptable degradation path, not equivalent to plugin-managed hooks). Alternative hook events also documented as fallback surface per Discussion 054 Doodlestein-adversarial Round 2: `PostToolUse` / `UserPromptSubmit` (not currently used but available if `SessionStart` / `SessionEnd` are deprecated). |
| 6 | `plugin.json` `hooks` block auto-registration | `empirical` (re-verified: 2026-05-20, CC version at T1 ship) | Plugin-level hook installation without manual `~/.claude/settings.json` editing | BL-023 historical concern (see closure evidence below). Empirical observation only — verified for CC version at ship time 2026-05-20; **NOT a contractual commitment** that future CC versions will preserve `plugin.json hooks` semantics. Re-verify on each CC major version bump. If `plugin.json hooks` auto-registration is dropped, fall back to manual settings.json wiring (see #5). |
| 7 | `userConfig` mechanism (plugin.json `userConfig` block) | `silent-degrade` | Gemini MCP server model selection — `gemini_flash_model` / `gemini_pro_model` are *intended* to map to `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL` / `CLAUDE_PLUGIN_OPTION_GEMINI_PRO_MODEL` at MCP startup. **Measured 2026-08-16 (F-082): an option the user never configured exports nothing, even though `plugin.json` declares a default for it.** Both variables are unset and the server runs on its own hardcoded fallbacks; whether a *configured* option materialises is untested. So the `silent-degrade` classification is right for the wrong reason — it degrades because the variable never arrives, not because the option is optional. | If removed: hard-code default models in `plugins/ae/mcp-servers/gemini/src/index.ts`, lose user customization. Acceptable degradation (default models still work — that is in fact the current state). **Do not reference a `${CLAUDE_PLUGIN_OPTION_*}` from a manifest `env` block**: those are validated at install time and an unresolved one rejects the whole server, so a declared-only default takes the server down instead of supplying its value. Read the option in-process with a fallback, as both bundled servers now do. |
| 8 | `mcpServers.*.env` passthrough (plugin.json `mcpServers.gemini.env`) | `silent-degrade` (becomes `fast-fail` on first MCP call when env unbound) | Gemini MCP server credential binding — `"env": {"GEMINI_API_KEY": "${GEMINI_API_KEY}"}` block injects host env var into the MCP server process at startup | If removed: require user to export `GEMINI_API_KEY` directly to the shell that spawns CC (lose declarative env binding); document migration in plugin-level CLAUDE.md. Two-stage failure: declarative bind silently fails at MCP startup (no user signal); first MCP call surfaces `gemini-proxy unavailable` error (visible). |
| 9 | `CLAUDE_PLUGIN_ROOT` env var | `fast-fail` | plugin.json `mcpServers.gemini.command` uses `${CLAUDE_PLUGIN_ROOT}` to locate the committed bundle it execs directly (`node "${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini/dist/index.mjs"`) | If renamed: plugin install fails fast with a visible "command not found" / "no such directory" error. User can self-diagnose and patch plugin.json. Low-severity failure mode. |
| 10 | `outputStyles` plugin.json field | `silent-degrade` | `plugins/ae/.claude-plugin/plugin.json:33` registers `output-styles/ae-structured.md` and `output-styles/ae-compact.md` as user-selectable output style options | If removed: registered output style names disappear from `/output-style` menu; user falls back to CC's default styles. No skill breakage (output styles are presentation-layer only). Mitigation: vendor styles into project-level `.claude/output-styles/` per user if AE-level registration breaks. |
| 11 | Plugin agent namespace prefix (`ae:` resolution) | `hard` | All 17 built-in agents in `plugins/ae/agents/{review,research,workflow,engineering}/` rely on CC resolving plugin agent IDs with `ae:` namespace prefix (e.g., `ae:review:architecture-reviewer`) for collision avoidance with project agents | If removed: agent name collisions with user's `.claude/agents/` cannot be deterministically resolved; AE built-in agents become unaddressable via `subagent_type:`. No fallback short of bundling AE as a non-plugin (deep refactor). Hard dependency on CC plugin-agent namespace resolution. |
| 12 | `ToolSearch` (deferred-tool schema lookup) | `silent-degrade` (fail-open) | `ae:work` Pre-check Check 3 probes `Agent` schema for `run_in_background` param to set `AGENT_TEAMS_FULL`; canonical fail-open path documented in `ae:work` SKILL.md (line ~132) | If `ToolSearch` unavailable or times out: `AGENT_TEAMS_FULL = true` (fail-open per spec). AE proceeds assuming full Agent Teams support. Misclassification cost: if Agent actually lacks `run_in_background` but ToolSearch is also down, AE attempts background spawn and fails at call time (visible error, not silent). Acceptable degradation. |

## Hook enforcement semantics

Dependencies #5 and #6 above establish that plugin-level hooks *register and
fire*. This section is the separate question of **how much a firing hook can
refuse** — the property AE must know before placing any control on one.

**Measured 2026-08-28 against CC 2.1.247**, non-interactive mode, foreground
subagents, plugin-level command hooks. Each row is one isolated scenario checked
against what actually happened — whether the file was written, what the task read
back, what the next model request received — not against a model's report of
success.

| Mechanism | Enforcement | What was observed |
|---|---|---|
| `PreToolUse` exit 2 | **refuses** | The tool call did not run; the file was not created |
| `PreToolUse` exit 1 | **fail-open** | Same hook, error exit: the file was created anyway |
| `PreToolUse` timeout | **fail-open** | Hook slept 10 s against a 1 s configured timeout; `PostToolUse` was reached ≈ 1,032 ms in and the file existed |
| `PreToolUse`, internal error caught and converted to exit 2 | **refuses** | Catchable errors are recoverable this way — it does not establish safety against a killed process or an outer timeout |
| `PostToolUse` `decision: block` | **feedback only** | The reason reached the next model request; the file remained. A follow-on step then proceeded and created a second file |
| `TaskCompleted` exit 2 | **refuses** | `TaskUpdate` returned `success: false` and `TaskGet` read back `pending`; the control scenario read back `completed` |
| `SubagentStop` exit 2 | **retries the same worker** | One agent ID, two `SubagentStop` firings; the calling session received only the second result |
| `SubagentStop` structural check | **usable** | A first plain-text deliverable was refused programmatically; a second conforming to the required shape was captured before the calling session saw it |

### What this means for AE

- **Only `PreToolUse` exit 2 and `TaskCompleted` exit 2 refuse anything.** A
  validator that errors or exceeds its timeout permits the call, so a hook is a
  detector, not a gate. Anything that must fail closed belongs in the Kernel,
  which recomputes from durable records.
- **`PostToolUse` is not a rollback.** The side effect has already happened and
  the following turn may ignore the reason.
- **`SubagentStop` gives an interception point, not a router.** A refusal makes
  the same worker try again; the choice between rework, a different reviewer, and
  a changed approach never reaches whoever should make it. Never hold a worker at
  its exit waiting for something only the caller can arrange.
- **A firing hook is not a state transition.** The `TaskCompleted` scenario fired
  `PostToolUse` on an update that returned a business failure. Parse the return
  value and read the state back.
- **Process exit status carries no business meaning.** All eight scenarios ended
  with the process reporting success, including both that refused a call.

### Classification and re-verification

`empirical` — the same class as #5 and #6, and for the same reason: this is
observed host behavior at one version, not a contractual commitment. The
`PreToolUse` timeout and `PostToolUse` semantics agree with the published hooks
reference, which states that a plugin command hook's timeout does not produce a
refusal and that a `PostToolUse` block appends a reason for the model. Do not
transfer Agent SDK callback timeout behavior, which the same documentation
defines separately, onto plugin command hooks.

**Re-verify on each CC major version bump**, and before any change that would
place an AE control on a hook.

**Not covered.** Interactive mode, background subagents, Agent Teams, compaction
and resume, cross-session recovery, concurrent writers, and interaction between
multiple plugins' hooks. None of these was exercised; no claim is made about them.

## Hook design surface — official semantics, cross-checked (2026-08-28)

The enforcement table above records what we **measured**. This section records
what the official hooks reference **documents** (fetched 2026-08-28,
code.claude.com/docs/en/hooks), cross-checked against those measurements, plus
the capabilities relevant to the rewrite that the measurements did not cover.
Classification: `empirical` = probed here; `documented` = official semantics not
yet probed — verify before making one load-bearing.

### Cross-check: every measurement matches the documented contract

| Measured (above) | Official semantics | Verdict |
|---|---|---|
| `PreToolUse` exit 2 refuses | "Always blocks on events that support blocking" | match |
| `PreToolUse` exit 1 fail-open | "Other exit codes: non-blocking error (action proceeds)" | match |
| `PreToolUse` timeout fail-open | "canceled, output discarded… doesn't block; call proceeds through normal permission flow" | match |
| `PostToolUse` feedback-only | "Can block: No (tool already ran)"; exit 2 merely "shows stderr to Claude" | match |
| `TaskCompleted` exit 2 refuses | "rolls back/prevents task state change" | match |
| `SubagentStop` exit 2 retries same worker | "prevents subagent from stopping" — continuation, not routing | match |

### Capabilities the probes did not cover (`documented`, unprobed)

| Capability | What it is | Why it matters to the rewrite |
|---|---|---|
| **Skill-frontmatter hooks** | A skill's YAML can register hooks, active from invocation for the rest of the session; `once: true` self-removes | **The unified entry can carry its own enforcement, scoped** — no plugin-global hooks, nothing runs for users who never invoke it |
| **Subagent-frontmatter hooks** | Hooks active only while that subagent runs; its `Stop` becomes `SubagentStop` | A reviewer seat can bring its own verification hooks and take them away when it exits |
| **`type: "agent"` hooks** (experimental) | The hook IS a subagent with Read/Grep/Glob, returning a JSON decision | A native mechanism for the checker-seat idea — a condition verified by an agent that can actually look, at a hook point |
| **`type: "prompt"` hooks** | Single-turn model evaluation of the hook input, JSON decision out | Cheap semantic checks where a regex is dishonest |
| **`Stop` deny** | Exit 2 / deny on `Stop` prevents the turn from ending; input carries `last_assistant_message` + `tool_use_count` | **The done-leash**: "you do not stop before the deliverable exists on disk" becomes checkable at the moment of claiming done. Fail-open on timeout, so an accelerator — but the strongest one available |
| **`PostToolBatch` deny** | Blocks the agentic loop before the next model call | A parent-level halt point the morning probes never found — coarser than routing, stronger than PostToolUse feedback |
| **`updatedInput`** (PreToolUse) | Hook rewrites the tool input before execution | Enforcement by correction rather than refusal — e.g. normalizing a path, adding a flag |
| **`FileChanged`** | Watch literal filenames; fires on disk change with content | **Tamper-visibility for frozen artifacts at ~1% of a ledger's cost**: watch the confirmed-criteria file, surface any post-freeze edit. Partially services BL-224 reopening-event #1's monitoring |
| **`if` permission-rule filter** | Per-hook rule like `Bash(git *)`, `Edit(*.ts)`; leading assignments stripped, `$()` and compound commands checked, best-effort | Precision without a matcher regex — but "best-effort; use the permission system for hard enforcement" is the doc's own words |
| **`UserPromptExpansion`** | Fires when a typed command expands, can block; matcher = command name | Inspect/refuse a skill invocation before the model sees it |
| **`TeammateIdle` deny** | Prevents a teammate going idle | The only documented control over team-member lifecycle |
| **`CLAUDE_PLUGIN_DATA`** | Per-plugin persistent data directory, exported to hooks | A sanctioned home for plugin state that is neither repo nor `~/.claude` hand-wiring |

### Design rules the two sources jointly force

1. **A hook is an accelerator, never the sole carrier of a rule.** Timeout and
   error are fail-open on nearly every event (`WorktreeCreate` is the lone
   fail-closed exception). Anything that must hold, holds in the artifact
   contract and the human gates; hooks make violations *visible sooner*.
2. **Scope hooks to the skill, not the plugin.** Frontmatter registration means
   the workflow's enforcement travels with the workflow. Plugin-global hooks
   stay for genuinely global concerns only (today: cross-family env check).
3. **Portability bound**: hooks are Claude Code surface. Any other host (e.g. a
   Codex port) gets the same workflow with zero hooks and must lose nothing but
   earliness of detection. If a rule breaks without its hook, rule 1 was
   violated.
4. **Anything from the `documented` table becomes load-bearing only after its
   own probe** — the same discipline that produced the enforcement table above.

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

Deterministic shell scripts under `plugins/ae/scripts/` that the harness skills shell out to (no CC-platform dependency beyond `sh`/`awk`/`jq`; each has a `tests/scripts/test-*.sh` exercised by `ae-run-tests.sh`):

| Script | Role |
|---|---|
| `loop-decide.sh` / `parse-review-verdict.sh` | review→fixup loop arithmetic + verdict normalization |
| `verify-contract.sh` | jq-assertion runner for `verify_by: contract` ACs (exit 0 = all pass) |

## Decommissioned dependencies (historical)

Dependencies AE no longer relies on, preserved here for archaeology:

- **`@include` directive in skill markdown** — previously used by `ae:agent-teams` cast block resolution to pull in shared protocol fragments. Decoupled in 2026-04 (a v0.9.x-cycle design challenge): content is now inlined into each consuming SKILL.md. No current dependency on `@include`; listed here only so future archaeology need not re-derive that this WAS once a dependency.

## Format reversal note

This document uses Markdown as the canonical format for v0.10.x. Markdown is human-optimized and unsuitable for programmatic consumption.

**Reversal trigger** (explicit, enforceable): when ANY of the following lands in a single PR/plan:

1. A new skill or agent (e.g., `ae:next` capability-check, `ae:setup` validation, `ae:review` drift detection) reads `cc-plugin-contract.md` programmatically (regex, JSON parsing, structured field access).
2. A consumer claims the 9-row 4-column table as a parseable contract (any code that depends on the table structure rather than human-readable content).
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
