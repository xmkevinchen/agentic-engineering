---
name: ae:test-plugin
description: Adversarial behavioral testing for AE plugin skills and agents
argument-hint: "<skill-name | --recent | --all> [--verbose] [--regression | --refresh]"
user-invocable: true
---

**Protocol Map** — if detail for any step is missing below, read this SKILL.md file directly before proceeding.
Phases: Pre-check → Phase 1 (Generation: 1.1 Spawn Team → 1.2 Review → 1.3 Writers Shutdown) → Phase 2 (Execution: Layer 1 Static → Layer 2 Live → Class A/B → Artifacts → Judge) → Phase 3 (Report)

# /ae:test-plugin — Adversarial Behavioral Testing (v2)

Generate and execute adversarial test cases for AE plugin skills/agents. Tests behavior compliance, not output content.

## Blind Execution Model

This skill uses a blind execution model to prevent self-easy-test bias:

- **test-lead** generates test cases (prompts + assertions) and judges execution output
- **Session TL** executes prompts without seeing assertions, collects raw output, sends to test-lead for judgment

This is a **behavioral contract** (prompt-level separation of concerns), not a technical enforcement. Session TL has filesystem access to test files — the blind property is maintained by following the protocol below. Violation looks like: Session TL reads the `## Expected Behavior` section of a test case before or during execution.

## Input

- `$ARGUMENTS` accepts three modes:
  - **Skill name** (e.g., `ae:plan`) → read the corresponding SKILL.md, generate targeted tests
  - `--recent` → find recently modified skill/agent files via `git diff HEAD~5 --name-only`. Filter to `plugins/ae/skills/` and `plugins/ae/agents/` paths only.
  - `--all` → scan all `plugins/ae/skills/*/SKILL.md` and `plugins/ae/agents/**/*.md`, generate comprehensive suite

### Flags

- `--verbose` — Session TL can see full test case content during execution (debug mode). Combinable with any other flag.
- `--regression` — skip Phase 1 generation, execute only existing `source: manual|regression` cases. If no matching cases exist for the target, warn and exit: `"No manual/regression cases found for [target]. Nothing to run."`
- `--refresh` — regenerate only `source: generated` cases, preserve `manual` and `regression`.
- `--layer1` — execute only Layer 1 (static analysis) cases. Skip all Layer 2 cases. Used by C.5 pre-commit check to avoid live execution side effects.

**`source` lifecycle**: test cases start as `source: generated` (Phase 1) or `source: manual` (hand-written). A user can manually change a generated case to `source: regression` after it catches a real bug, marking it as a permanent regression guard.
- `--regression` and `--refresh` are **mutually exclusive** (error if both provided).
- `--layer1` is **combinable** with `--regression` or `--refresh`.

## Pre-check

1. **Agent Teams**: check enabled (same as other skills)
2. **Target resolution**: resolve input to file paths. If skill name → find `plugins/ae/skills/<name>/SKILL.md`. If not found → refuse with suggestion.
3. **Judge health check**: read `pipeline.yml` → `test_plugin.judge` (default: `codex`). Verify the judge is reachable:
   - `codex` → check `mcp__plugin_ae_codex__codex` tool is available
   - `gemini` → check `mcp__plugin_ae_gemini__chat` tool is available
   - `claude` → always available (self-judge, weaker independence)
   - If unreachable → abort: `"Judge [name] is not reachable. Check MCP server status or change test_plugin.judge in pipeline.yml."`

## Phase 1: Test Case Generation

**Skip if `--regression` flag is set.**

If `--refresh` flag is set, delete existing `source: generated` test files for the target before generation.

### 1.1 Spawn Test Team

```
TeamCreate(team_name: "test-<target>")

Agent(subagent_type: "test-lead", name: "test-lead",
      team_name: "<team>", run_in_background: true,
      prompt: "Read <target files>. Generate adversarial test case outlines.
               Prioritize: refusal/boundary → tool calls → output format.
               All generated cases MUST have `source: generated` in frontmatter.
               Teammates: prompts-writer, answer-writer.
               Distribute outline to writers. Review their output.
               Only SendMessage approved suite to team lead (Session TL).")

Agent(subagent_type: "general-purpose", name: "prompts-writer",
      team_name: "<team>", run_in_background: true,
      prompt: "You are the Prompts Writer. Wait for test case outline from test-lead.
               For each test case, write a Markdown file to plugins/ae/tests/prompts/<id>.md:
               - frontmatter (id, target, layer, source: generated)
               - ## Context (pre-conditions)
               - ## Prompt (exact input to trigger the skill)
               Write 2-3 prompt variants per case for robustness.
               SendMessage all drafts to test-lead for review. Do NOT message Session TL.")

Agent(subagent_type: "general-purpose", name: "answer-writer",
      team_name: "<team>", run_in_background: true,
      prompt: "You are the Answer Writer. Wait for test case outline from test-lead.
               For each test case, independently write a Markdown file to plugins/ae/tests/assertions/<id>.md:
               - frontmatter (id, target, layer, source: generated)
               - ## Expected Behavior section with MUST / MUST_NOT / SHOULD assertions
               Each assertion must be mechanically verifiable (file exists, keyword present,
               tool called) or clearly marked as LLM-judge required.
               SendMessage all drafts to test-lead for review. Do NOT message Session TL.
               Do NOT read prompts-writer's output — write independently.")
```

### 1.2 Test-lead Reviews and Approves

test-lead reviews writer output for:
- **Coverage**: all testable behaviors from the SKILL.md have at least one test case
- **Adversarial quality**: edge cases covered (empty input, missing config, proxy failure)
- **Assertion verifiability**: every MUST/MUST_NOT can be checked

If insufficient → feedback to writers for revision. If approved → confirm files written to `plugins/ae/tests/prompts/` and `plugins/ae/tests/assertions/` (separate directories), SendMessage to Session TL.

**File isolation**: prompt files and assertion files MUST be in separate directories. This enforces blind protocol — Session TL reads only `prompts/`, test-lead/judge reads `assertions/`. Do NOT merge them into a single file.

### 1.3 Writers Shutdown (Team Stays Alive)

Session TL receives approved suite → shutdown writers only (prompts-writer, answer-writer). **test-lead stays alive in the team** — it will judge execution output in Phase 2.

**Do NOT TeamDelete here.** The test team persists into Phase 2 for Class A execution. Class B will TeamDelete at the start of Phase 2 (see Phase 2 → Class B Path).

**Context transfer**: test cases are split across `plugins/ae/tests/prompts/` and `plugins/ae/tests/assertions/`. If the team must be rebuilt (Class B), the resurrected test-lead recovers context by reading assertion files from `assertions/`.

## Phase 2: Execution

### Info Flow (Blind Protocol)

```
prompts-writer  → plugins/ae/tests/prompts/<id>.md      (Context + Prompt)
answer-writer   → plugins/ae/tests/assertions/<id>.md   (Expected Behavior)
                                    │
Session TL reads ONLY:              │
  - plugins/ae/tests/prompts/       │  ← prompt files
                                    │
Session TL does NOT read:           │
  - plugins/ae/tests/assertions/    │  ← assertion files
                                    │
Session TL executes prompt ──────→ collects artifacts (git diff + teams dir + output text)
                                    │
Session TL sends artifacts ──────→ test-lead
                                    │
test-lead reads assertions/ + artifacts → applies checks → returns verdict
```

**Blind protocol enforcement**: prompt and assertion files are in separate directories. Session TL only reads `prompts/`. This is structural isolation, not just a behavioral contract.

**`--verbose` override**: when set, Session TL also reads `assertions/`. This breaks blind separation but enables debugging.

### Layer 1: Deterministic Checks (Static Analysis)

Layer 1 does NOT execute the skill. It verifies behavior through static analysis of SKILL.md content. **Blind protocol does not apply to Layer 1** — Session TL reads both `prompts/<id>.md` and `assertions/<id>.md` because static analysis requires checking assertions against SKILL.md text.

For each Layer 1 test case:
1. Read the prompt file (`prompts/<id>.md`) and assertion file (`assertions/<id>.md`)
2. Read the target SKILL.md
3. Check MUST assertions by static analysis: does the SKILL.md contain the expected logic?
4. Check MUST_NOT assertions: forbidden patterns absent in SKILL.md?
5. Record: PASS or FAIL (which assertion failed)

Layer 1 failures are definitive — no LLM judgment needed, no side effects.

### Layer 2: Behavioral Checks (Live Execution)

Only runs if Layer 1 passed for this test case.

#### Execution Classification

Before executing, classify the target skill:

- **Scan** the target SKILL.md for `TeamCreate` or `Agent(` patterns
- **Class A** (patterns not found): skill does not require Agent Teams → subagent can execute
- **Class B** (patterns found): skill requires Agent Teams → Session TL must execute directly
- **Unreadable target**: → `FAIL_CLOSED` (classification_error, do not execute)

#### Isolation: Git Worktree (both classes)

Both Class A and Class B use git worktree for isolation. Worktree is the isolation layer; Agent is the execution layer. These are separate concerns.

```
1. Record baseline: HEAD_SHA=$(git rev-parse HEAD)
2. Create worktree: git worktree add /tmp/test-<id> -b test-<id>
3. Execute in worktree (see Class A / Class B below)
4. Collect artifacts (diff against baseline)
5. Cleanup: git worktree remove /tmp/test-<id> && git branch -D test-<id>
```

Worktree creation failure → `FAIL_CLOSED` (isolation_error, do not execute without isolation).

#### Class A Execution (subagent, test team stays alive)

```
1. Create git worktree
2. Spawn general-purpose subagent (isolation: "worktree")
3. Subagent reads prompt from plugins/ae/tests/prompts/<id>.md (blind protocol)
4. Subagent executes the skill in worktree
5. Subagent writes artifacts to file
6. Session TL reads artifact file → forwards to test-lead (still alive in test team)
7. test-lead reads assertions/<id>.md + artifacts → judges → returns verdict
```

Test team persists throughout — no TeamDelete needed for Class A.

**Worktree memory isolation**: When spawning agents in worktree, include in their prompt: "Do not write to ~/.claude/projects/*/memory/. You are in an isolated worktree — memory writes would pollute the user's project memory."

#### Class B Execution (team rebuild, Session TL executes)

Class B skills need Agent Teams (TeamCreate). The test team must be released first.

```
Phase 2.1: Team Release
1. TeamDelete test team (release slot for target skill)

Phase 2.2: Worktree + Team Rebuild
2. Create git worktree
3. One TeamCreate — include BOTH:
   - Target skill's required agents (per the skill being tested)
   - Resurrected test-lead (context recovered from assertion files)

   Resurrection prompt for test-lead:
   "You are test-lead, resurrected for Phase 2 judgment.
    Read assertion files from plugins/ae/tests/assertions/ (MAIN REPO path, not worktree —
    Phase 1 files are uncommitted and not visible in worktree).
    Do NOT regenerate test cases. Enter Judge mode directly.
    Wait for execution artifacts from Session TL."

Phase 2.3: Execute
4. Session TL reads prompt from plugins/ae/tests/prompts/<id>.md (MAIN REPO path, not worktree —
   same as assertions, Phase 1 files are uncommitted and not visible in worktree)
5. Session TL executes the target skill in worktree context
6. Collect artifacts

Phase 2.4: Judge
7. Session TL sends artifacts to resurrected test-lead
8. test-lead reads assertions (main repo path) + artifacts → judges → returns verdict

Phase 2.5: Cleanup
9. TeamDelete rebuilt team
10. Remove worktree: git worktree remove /tmp/test-<id> && git branch -D test-<id>
11. Defensive cleanup: check ~/.claude/teams/ for orphan teams created by target skill
    (skill crash may leave uncleaned teams)
```

**Main repo path for assertions**: Phase 1 writes assertion files to `plugins/ae/tests/assertions/` in the main working directory. These files are uncommitted and NOT visible in the worktree. Resurrected test-lead MUST read from the main repo path, not the worktree path.

#### Artifact Collection Protocol

After execution (Class A or B), collect:

1. **File changes**: `git diff --name-only` in worktree (compare to baseline SHA)
2. **Team creation**: `ls ~/.claude/teams/` — check for new `inboxes/` directories
3. **State changes**: read plan/task frontmatter for status transitions
4. **Output text**: capture execution output (messages, warnings, refusals)

**Dual verification**: assertions check both:
- **Outcome** — did the right artifacts appear? (files created, teams spawned, status changed)
- **Process** — did the skill follow the correct flow? (refusal at correct check, correct ordering)

### Typed Assertion Format

Assertions use **type tags as dispatch hints** — they tell test-lead which verification method to use. Tags are semantic hints, not parseable syntax; test-lead (an LLM) reads the natural language description to understand what to check.

| Tag | Verification | Meaning |
|-----|-------------|---------|
| `[file:exists]` | Mechanical | A file at the described path exists |
| `[file:changed]` | Mechanical | A file appears in git diff output |
| `[file:contains]` | Mechanical | A file contains the described pattern |
| `[team:exists]` | Mechanical | Team inboxes/ directory exists |
| `[text:contains]` | Mechanical | Output text contains the described keyword |
| `[text:regex]` | Mechanical | Output text matches the described regex |
| `[behavior]` | LLM judge | Requires semantic judgment (no mechanical shortcut) |

**Dispatch rules**:
- `[file:*]`, `[team:*]`, `[text:*]` → **mechanical verification** (test-lead checks directly, no LLM judge)
- `[behavior]` → **LLM judge** (always routed to configured judge)
- `MUST` / `MUST_NOT` → gate (any failure = case FAIL)
- `SHOULD` → advisory (failure noted but case can still PASS)

**Writing assertions**: use the tag + natural language description. Test-lead interprets the description to determine the specific file path, pattern, or team name from context. Example: `MUST [file:contains] Plan file contains ## Steps section` — test-lead knows to check the plan output file for "## Steps".

### Judge Protocol

**Class A**: test-lead is still alive in the test team. Session TL forwards artifacts to test-lead via SendMessage. test-lead reads `assertions/<id>.md` and judges.

**Class B**: test-lead was resurrected in the rebuilt team. Session TL sends artifacts via SendMessage. Resurrected test-lead reads assertions from **main repo path** (not worktree) and judges.

**Verdict format** — judge returns per assertion:
```json
{
  "verdict": "PASS|FAIL",
  "assertion": "<typed assertion>",
  "method": "mechanical|judge",
  "reasoning": "<why it passed or failed>"
}
```

Judge selection (from `pipeline.yml` → `test_plugin.judge`):
- `codex` (default) → test-lead routes `[behavior]` assertions to codex-proxy for independent evaluation
- `gemini` → test-lead routes to gemini-proxy
- `claude` → test-lead self-judges (weaker independence, but no external dependency)

Mechanical assertions (`[file:*]`, `[team:*]`, `[text:*]`) are always verified directly, regardless of judge selection.

Layer 2 failures are advisory — may need human review for edge cases.

## Phase 3: Report

Write test report to `pipeline.yml` → `output.reviews` as `NNN-test-report-slug.md`:

```markdown
---
id: "NNN"
title: "Test Report: [target]"
type: test-report
created: YYYY-MM-DD
target: "[skill/agent name]"
---

# Test Report: [target]

## Summary
- Total: N cases
- Layer 1: X/Y pass (Z%)
- Layer 2: A/B pass (C%)
- Overall: PASS / FAIL

## Execution Info
- Isolation: worktree (/tmp/test-<id>)
- Baseline SHA: <HEAD_SHA>
- Class: A (subagent) / B (team rebuild)
- Team lifecycle: [kept alive | TeamDelete → rebuild]
- Orphan cleanup: [none | cleaned N teams]

## Results

| # | Case | Target | Layer | Class | Result | Failed Assertion |
|---|------|--------|-------|-------|--------|-----------------|
| 1 | refuse-no-agent-teams | ae:plan | 1 | — | PASS | |
| 2 | plan-output-format | ae:plan | 2 | B | FAIL | SHOULD: Expected files in every step |

## Failed Cases Detail
### Case 2: plan-output-format
- Assertion: SHOULD — every plan step contains "Expected files:" line
- Actual: Step 3 missing Expected files
- Severity: P2
```

**You MUST call the Write tool to save the report. Displaying in conversation is not sufficient.**

## Next Steps

Based on test results, suggest:
- If all pass → `Tests passed. Plugin behavior verified.`
- If Layer 1 failures → `P1 behavioral failures found. Fix skill definitions and re-test.`
- If Layer 2 only failures → `Advisory findings. Review and decide: fix or accept.`
- If new test cases needed → `Run /ae:test-plugin <target> to regenerate with updated definitions.`
