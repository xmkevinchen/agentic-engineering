---
name: ae:test-plugin
description: Adversarial behavioral testing for AE plugin skills and agents
argument-hint: "<skill-name | --recent | --all> [--verbose] [--regression | --refresh]"
user_invocable: true
---

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

**`source` lifecycle**: test cases start as `source: generated` (Phase 1) or `source: manual` (hand-written). A user can manually change a generated case to `source: regression` after it catches a real bug, marking it as a permanent regression guard.
- `--regression` and `--refresh` are **mutually exclusive** (error if both provided).

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
               For each test case, write a Markdown test file with:
               - frontmatter (id, target, layer, source: generated)
               - ## Context (pre-conditions)
               - ## Prompt (exact input to trigger the skill)
               Write 2-3 prompt variants per case for robustness.
               SendMessage all drafts to test-lead for review. Do NOT message Session TL.")

Agent(subagent_type: "general-purpose", name: "answer-writer",
      team_name: "<team>", run_in_background: true,
      prompt: "You are the Answer Writer. Wait for test case outline from test-lead.
               For each test case, independently write:
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

If insufficient → feedback to writers for revision. If approved → compile test suite, write files to `plugins/ae/tests/`, SendMessage to Session TL.

### 1.3 Close Test Team

Session TL receives approved suite → shutdown prompts-writer and answer-writer. **test-lead persists** for Phase 2 judgment. test-lead is shut down after Phase 3 report is complete.

## Phase 2: Execution

### Info Flow (Blind Protocol)

```
test-lead writes test files → plugins/ae/tests/
                                    │
Session TL reads ONLY:              │
  - frontmatter (id, target, layer) │
  - ## Prompt section                │
  - ## Context section               │
                                    │
Session TL does NOT read:           │
  - ## Expected Behavior             │
  - MUST / MUST_NOT / SHOULD         │
                                    │
Session TL executes prompt ──────→ collects raw output (text + tool calls + artifacts)
                                    │
Session TL sends raw output ─────→ test-lead
                                    │
test-lead holds assertions + output → applies checks → returns verdict
```

**`--verbose` override**: when set, Session TL reads the full test case including Expected Behavior. This breaks blind separation but enables debugging.

### Layer 1: Deterministic Checks (Static Analysis)

Layer 1 does NOT execute the skill. It verifies behavior through static analysis of SKILL.md content. **Blind protocol does not apply to Layer 1** — Session TL reads the full test case (including Expected Behavior) because static analysis requires checking assertions against SKILL.md text.

For each Layer 1 test case:
1. Read the full test case (Context + Prompt + Expected Behavior)
2. Read the target SKILL.md
3. Check MUST assertions by static analysis: does the SKILL.md contain the expected logic?
4. Check MUST_NOT assertions: forbidden patterns absent in SKILL.md?
5. Record: PASS or FAIL (which assertion failed)

Layer 1 failures are definitive — no LLM judgment needed, no side effects.

### Layer 2: Behavioral Checks (Live Execution)

Only runs if Layer 1 passed for this test case.

**Warning**: Layer 2 executes skills in the current session. This creates real side effects (files, commits, agent teams). Use on a clean branch or test project.

For each Layer 2 test case:
1. Read prompt + context only (blind protocol)
2. Execute the prompt (run the skill in current context)
3. Collect raw output (text + tool calls + file artifacts)
4. Send raw output to judge for evaluation

### Judge Protocol

Session TL sends execution output to test-lead (or configured judge) for evaluation.

**Verdict format** — judge returns per case:
```json
{
  "verdict": "PASS|FAIL",
  "assertion": "<which assertion was checked>",
  "reasoning": "<why it passed or failed>"
}
```

Judge selection (from `pipeline.yml` → `test_plugin.judge`):
- `codex` (default) → test-lead sends output to codex-proxy for independent evaluation
- `gemini` → test-lead sends output to gemini-proxy
- `claude` → test-lead self-judges (weaker independence, but no external dependency)

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

## Results

| # | Case | Target | Layer | Result | Failed Assertion |
|---|------|--------|-------|--------|-----------------|
| 1 | refuse-no-agent-teams | ae:plan | 1 | PASS | |
| 2 | plan-output-format | ae:plan | 2 | FAIL | SHOULD: Expected files in every step |

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
