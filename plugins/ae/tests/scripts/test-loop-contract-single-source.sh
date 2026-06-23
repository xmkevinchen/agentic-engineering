#!/bin/sh
# test-loop-contract-single-source.sh — BL-146 single-source sentinel
#
# Guards the loop-finalize contract against re-drift: the per-iteration-SKIP /
# terminal-RUN RULE lives in ONE place (review/SKILL.md § Completion Invariant);
# work/SKILL.md REFERENCES it and must not restate the rule-as-authority.
#
# Honest scope (codex + adversarial F5): this is a deterministic sentinel for
# KNOWN restatement forms — semantic completeness (a reworded shadow restatement)
# is the job of /ae:plan's AC2 judge, not this test. The denylist targets the
# rule-statement markers ("never archives" / "runs only standalone" /
# "per-iteration loop-mode") — NOT loop-ACTION terms like "terminal exit_pass",
# which the loop legitimately uses to describe its own control flow.

set -eu

ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
WORK="$ROOT/plugins/ae/skills/work/SKILL.md"
REVIEW="$ROOT/plugins/ae/skills/review/SKILL.md"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$WORK" ] || fail "work/SKILL.md not found at $WORK"
[ -f "$REVIEW" ] || fail "review/SKILL.md not found at $REVIEW"

# (a) PRECONDITION — the section heading must exist (strategic: prevents a
#     false-safe green if the section is renamed/removed).
grep -qF '## Harness-driven loop' "$WORK" \
  || fail "SECTION_MISSING: '## Harness-driven loop' heading absent in work/SKILL.md (rename/removal → sentinel cannot scope; failing loud)"

# Extract the '## Harness-driven loop' section (heading → next '## ' or EOF).
SECTION="$(awk '/^## Harness-driven loop/{f=1} f&&/^## /&&!/^## Harness-driven loop/{if(seen)exit} {if(f)print; if(/^## Harness-driven loop/)seen=1}' "$WORK")"
[ -n "$SECTION" ] || fail "SECTION_MISSING: extracted harness-loop section is empty"

# (b) DENYLIST — rule-restatement markers must NOT appear in work's loop section.
for marker in "never archives" "runs only standalone" "per-iteration loop-mode"; do
  if printf '%s\n' "$SECTION" | grep -qiF "$marker"; then
    fail "RESTATEMENT: work/SKILL.md harness-loop section restates the SKIP/RUN rule ('$marker') — that rule belongs to review/SKILL.md § Completion Invariant; reference it, don't restate it (BL-146)"
  fi
done

# (c) POSITIVE — work must reference review's Completion Invariant.
printf '%s\n' "$SECTION" | grep -qE '/ae:review.*Completion Invariant' \
  || fail "REFERENCE_MISSING: work/SKILL.md harness-loop section must reference /ae:review's Completion Invariant (the single source), not silently drop it"

# (d) Canonical rule still lives in review/SKILL.md (the single source).
grep -qF 'SKIP this entire section' "$REVIEW" && grep -qF 'RUN it in full' "$REVIEW" \
  || fail "CANONICAL_MISSING: review/SKILL.md no longer holds the canonical SKIP/RUN rule (the single source moved or was deleted)"

echo "ok loop-contract single-source (review owns the rule; work references it)"
