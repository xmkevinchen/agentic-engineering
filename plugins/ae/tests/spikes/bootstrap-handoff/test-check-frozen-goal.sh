#!/bin/sh
# test-check-frozen-goal.sh — F-083 AC13, freeze-check half.
#
# The frozen goal is the only immutable statement of what the work must satisfy, and the
# extractor is what decides which bytes those are. Every case here is a way the extraction could
# be wrong while every downstream digest still agrees with itself.
#
# Fixture-driven on purpose: the live plan and goal live under `.ae/**`, which is gitignored, so
# a tracked test that depended on them would assert nothing in a fresh clone. When they ARE
# present the last case checks them too, because a real mismatch there is repairable and should
# redden the run on the machine where the feature is live.
#
# Run: sh plugins/ae/tests/spikes/bootstrap-handoff/test-check-frozen-goal.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../../.." && pwd))"
SUBJECT="$THIS/check-frozen-goal.sh"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

[ -f "$SUBJECT" ] || { bad "subject missing: $SUBJECT"; echo "test-check-frozen-goal: FAIL" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# A plan whose Acceptance Criteria section is bounded on both sides, carries a `###`
# subheading that belongs to it, and is followed by a level-2 heading that does not.
make_plan() { # $1 = destination
  cat > "$1" <<'EOF'
# Feature: fixture

## Goal

Something before the section.

## Acceptance Criteria

### AC1: first
- verify_by: unit

Body text for AC1.

### AC2: second
- verify_by: integration

Body text for AC2.

## Parallel strategy

Something after the section.
EOF
}

extract_expected() { # $1 = plan -> the bytes the boundary rule defines
  awk '
    $0 == "## Acceptance Criteria" { emit = 1 }
    emit && /^## / && $0 != "## Acceptance Criteria" { exit }
    emit { print }
  ' "$1"
}

make_plan "$TMP/plan.md"
extract_expected "$TMP/plan.md" > "$TMP/goal.md"

# 1. The happy path, and the digests it must print.
if out="$(sh "$SUBJECT" "$TMP/plan.md" "$TMP/goal.md" 2>&1)"; then
  if printf '%s\n' "$out" | grep -q '^plan_sha256=[0-9a-f]\{64\}$' &&
     printf '%s\n' "$out" | grep -q '^acceptance_section_sha256=[0-9a-f]\{64\}$' &&
     printf '%s\n' "$out" | grep -q '^goal_sha256=[0-9a-f]\{64\}$'; then
    ok "a verbatim goal is accepted and all three digests are reported"
  else
    bad "the verbatim goal was accepted but the three digests were not all reported"
  fi
else
  bad "a verbatim goal was rejected"
  printf '%s\n' "$out" | sed 's/^/       /' >&2
fi

# The section must include its `###` subheadings and stop before the next `##`.
if grep -q '^### AC2: second$' "$TMP/goal.md" && ! grep -q '^## Parallel strategy$' "$TMP/goal.md"; then
  ok "the boundary keeps ### subheadings and stops before the next ## heading"
else
  bad "the extraction boundary is wrong: it dropped a ### subheading or ran into the next ## heading"
fi

# 2. No exact heading.
sed 's/^## Acceptance Criteria$/## Acceptance criteria/' "$TMP/plan.md" > "$TMP/plan-noheading.md"
sh "$SUBJECT" "$TMP/plan-noheading.md" "$TMP/goal.md" >/dev/null 2>&1
case $? in
  3) ok "a missing exact '## Acceptance Criteria' heading is rejected" ;;
  0) bad "a plan with no exact heading was accepted" ;;
  *) ok "a missing exact heading is rejected" ;;
esac

# 3. Duplicate exact heading — two answers to the same question. The bootstrap-era extractor
#    stopped at the first and never saw the second; this must not.
{ cat "$TMP/plan.md"; printf '\n## Acceptance Criteria\n\n### AC9: smuggled\n'; } > "$TMP/plan-dup.md"
sh "$SUBJECT" "$TMP/plan-dup.md" "$TMP/goal.md" >/dev/null 2>&1
case $? in
  3) ok "a duplicate exact heading is rejected" ;;
  0) bad "a plan with two '## Acceptance Criteria' headings was accepted — half the contract would freeze silently" ;;
  *) bad "a duplicate heading failed for the wrong reason (exit $?)" ;;
esac

# 4. Wrong extraction boundary: a goal that swallowed one line past the section.
{ cat "$TMP/goal.md"; printf '## Parallel strategy\n'; } > "$TMP/goal-over.md"
if sh "$SUBJECT" "$TMP/plan.md" "$TMP/goal-over.md" >/dev/null 2>&1; then
  bad "a goal extending past the section boundary was accepted"
else
  ok "a goal extending past the section boundary is rejected"
fi

# ...and one that stopped short of it.
sed '$d' "$TMP/goal.md" > "$TMP/goal-short.md"
if sh "$SUBJECT" "$TMP/plan.md" "$TMP/goal-short.md" >/dev/null 2>&1; then
  bad "a truncated goal was accepted"
else
  ok "a goal that stops short of the section boundary is rejected"
fi

# 5. Non-identical bytes. Not a paraphrase — one character, in a place a reader would skim past.
sed 's/verify_by: unit/verify_by: judge/' "$TMP/goal.md" > "$TMP/goal-edited.md"
if sh "$SUBJECT" "$TMP/plan.md" "$TMP/goal-edited.md" >/dev/null 2>&1; then
  bad "an edited goal was accepted — 'byte-identical' would mean nothing"
else
  ok "a goal edited in one field is rejected"
fi

# A trailing newline is a byte too. This is the difference a copy-paste introduces.
{ cat "$TMP/goal.md"; printf '\n'; } > "$TMP/goal-nl.md"
if sh "$SUBJECT" "$TMP/plan.md" "$TMP/goal-nl.md" >/dev/null 2>&1; then
  bad "a goal with an extra trailing newline was accepted"
else
  ok "a goal differing only by a trailing newline is rejected"
fi

# 6. A modified extractor. The point of recording the script's digest is that the script is not
#    neutral: swap it and the same plan freezes different bytes, with every downstream digest
#    still internally consistent. Asserted by observation, not by hashing this file from inside
#    itself — an artifact that hashes itself proves nothing.
sed 's|emit && /\^## / && \$0 != "## Acceptance Criteria" { exit }|emit \&\& /^### / \&\& $0 !~ /AC1/ { exit }|' \
  "$SUBJECT" > "$TMP/modified.sh"
if cmp -s "$SUBJECT" "$TMP/modified.sh"; then
  bad "the modified-extractor fixture did not actually modify the extractor"
else
  mod_out="$(sh "$TMP/modified.sh" "$TMP/plan.md" "$TMP/goal.md" 2>&1 || true)"
  if printf '%s\n' "$mod_out" | grep -q '^frozen-goal: OK$'; then
    bad "a modified extractor still accepted the same goal — the recorded script digest is decorative"
  else
    ok "a modified extractor freezes different bytes and is caught — the recorded script digest is load-bearing"
  fi
fi

# 7. The live pair, when this clone has it. `.ae/**` is ignored, so absence is normal and not a
#    failure; presence plus a mismatch is a real, repairable defect and gates here.
live_plan="$REPO/.ae/features/active/F-083-ae-v1-implementation/plan.md"
live_goal="$REPO/.ae/features/active/F-083-ae-v1-implementation/goal.frozen.md"
if [ -f "$live_plan" ] && [ -f "$live_goal" ]; then
  if out="$(sh "$SUBJECT" "$live_plan" "$live_goal" 2>&1)"; then
    ok "the live F-083 goal is the verbatim Acceptance Criteria section of the live plan"
  else
    bad "the live F-083 goal does not match its plan:"
    printf '%s\n' "$out" | head -20 | sed 's/^/       /' >&2
  fi
else
  echo "  --: no live F-083 plan/goal in this clone (.ae/** is ignored); fixtures above still gate"
fi

if [ "$fail" -eq 0 ]; then
  echo "test-check-frozen-goal: PASS"
else
  echo "test-check-frozen-goal: FAIL" >&2
fi
exit "$fail"
