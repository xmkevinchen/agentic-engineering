---
name: ae:test-plugin
description: Adversarial behavioral testing for AE plugin skills and agents
argument-hint: "<skill-name | --recent | --all>"
user_invocable: true
---

# /ae:test-plugin — Adversarial Behavioral Testing

Generate and execute adversarial test cases for AE plugin skills/agents. Tests behavior compliance, not output content.

## Input

- `$ARGUMENTS` accepts three modes:
  - **Skill name** (e.g., `ae:plan`) → read the corresponding SKILL.md, generate targeted tests
  - `--recent` → find recently modified skill/agent files via `git diff HEAD~5 --name-only` (last 5 commits) or unstaged changes. Filter to `plugins/ae/skills/` and `plugins/ae/agents/` paths only.
  - `--all` → scan all `plugins/ae/skills/*/SKILL.md` and `plugins/ae/agents/**/*.md`, generate comprehensive suite

## Pre-check

1. **Agent Teams**: check enabled (same as other skills)
2. **Target resolution**: resolve input to file paths. If skill name → find `plugins/ae/skills/<name>/SKILL.md`. If not found → refuse with suggestion.

## Phase 1: Test Case Generation

### 1.1 Spawn Test Team

```
TeamCreate(team_name: "test-<target>")

Agent(subagent_type: "test-lead", name: "test-lead",
      team_name: "<team>", run_in_background: true,
      prompt: "Read <target files>. Generate adversarial test case outlines.
               Prioritize: refusal/boundary → tool calls → output format.
               Teammates: prompts-writer, answer-writer.
               Distribute outline to writers. Review their output.
               Only SendMessage approved suite to team lead (Session TL).")

Agent(subagent_type: "general-purpose", name: "prompts-writer",
      team_name: "<team>", run_in_background: true,
      prompt: "You are the Prompts Writer. Wait for test case outline from test-lead.
               For each test case, write a Markdown test file with:
               - frontmatter (id, target, layer)
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

Session TL receives approved suite → shutdown test team.

## Phase 2: Execution

Session TL executes test cases sequentially.

### Layer 1: Deterministic Checks (Static Analysis)

Layer 1 does NOT execute the skill. It verifies behavior through static analysis of SKILL.md content.

For each Layer 1 test case:
1. Read the test case Markdown (Context + Prompt + Expected Behavior)
2. Read the target SKILL.md
3. Check MUST assertions by static analysis: does the SKILL.md contain the expected logic? (e.g., grep for "refuse" in pre-check section, verify Expected files template exists, check tool references)
4. Check MUST_NOT assertions: forbidden patterns absent in SKILL.md?
5. Record: PASS (all MUST met, no MUST_NOT violated) or FAIL (which assertion failed)

Layer 1 failures are definitive — no LLM judgment needed, no side effects.

### Layer 2: Behavioral Checks (Live Execution)

Only runs if Layer 1 passed for this test case.

**Warning**: Layer 2 executes skills in the current session. This creates real side effects (files, commits, agent teams). Use on a clean branch or test project.

For each Layer 2 test case:
1. Execute the prompt (run the skill in current context)
2. Collect output (text + tool calls + file artifacts)
3. LLM-as-judge: evaluate SHOULD assertions against collected output
4. Record: PASS / FAIL with judge reasoning

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
