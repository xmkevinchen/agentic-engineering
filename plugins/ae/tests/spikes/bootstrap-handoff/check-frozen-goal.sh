#!/bin/sh
# check-frozen-goal.sh — prove a frozen goal is the verbatim Acceptance Criteria section of its
# plan. It does not create, approve, or promote anything.
#
# The tracked replacement for the ignored bootstrap-era script whose bytes the first work
# request pinned by digest. That pin exists because the extractor decides what "the frozen
# Acceptance Criteria" means: change the extractor and the same plan yields a different frozen
# goal, with every downstream digest still agreeing. So the script is evidence, and this one
# tightens two things its predecessor left open:
#
#   * The heading must appear EXACTLY ONCE. A second `## Acceptance Criteria` further down is a
#     second answer to the same question, and an extractor that stops at the first one would
#     freeze half a contract without noticing the other half.
#   * The boundary is stated and checked rather than implied: the section runs from the heading
#     line through the byte before the next level-2 (`## `) heading, or to end of file. `###`
#     subheadings belong to the section and are kept.
#
# Usage: sh check-frozen-goal.sh <plan.md> <goal.frozen.md>
# Exit 0 = the goal is byte-identical to the extraction, and the three digests are printed.
#      1 = the goal differs from the extraction.
#      2 = usage error or an unreadable input.
#      3 = the plan does not carry exactly one `## Acceptance Criteria` heading.

set -eu

[ "$#" -eq 2 ] || {
  echo "usage: sh check-frozen-goal.sh <plan.md> <goal.frozen.md>" >&2
  exit 2
}

plan=$1
goal=$2
[ -f "$plan" ] || { echo "missing plan: $plan" >&2; exit 2; }
[ -f "$goal" ] || { echo "missing goal: $goal" >&2; exit 2; }

headings=$(grep -c '^## Acceptance Criteria$' "$plan" || true)
[ "$headings" -eq 1 ] || {
  if [ "$headings" -eq 0 ]; then
    echo "frozen-goal: no exact '## Acceptance Criteria' heading in $plan" >&2
  else
    echo "frozen-goal: $headings exact '## Acceptance Criteria' headings in $plan — the section to freeze is ambiguous" >&2
  fi
  exit 3
}

tmp=$(mktemp "${TMPDIR:-/tmp}/frozen-goal.XXXXXX")
trap 'rm -f "$tmp"' EXIT HUP INT TERM

awk '
  $0 == "## Acceptance Criteria" { emit = 1 }
  emit && /^## / && $0 != "## Acceptance Criteria" { exit }
  emit { print }
' "$plan" > "$tmp"

if ! cmp -s "$tmp" "$goal"; then
  echo "frozen-goal mismatch: the goal is not the verbatim Acceptance Criteria section" >&2
  diff -u "$tmp" "$goal" >&2 || true
  exit 1
fi

sha() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

echo "frozen-goal: OK"
echo "plan_sha256=$(sha "$plan")"
echo "acceptance_section_sha256=$(sha "$tmp")"
echo "goal_sha256=$(sha "$goal")"
