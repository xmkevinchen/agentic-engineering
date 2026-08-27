#!/bin/sh
# The rules the first Kernel runs produced are present where they belong — the five
# adopt-now rules, and the stage boundaries they made concrete.
#
# HONEST SCOPE, stated first: this checks that the instructions exist and say the
# load-bearing thing. It cannot check that a model followed them. That gap is the
# finding those runs produced — of seventeen backlog items only two could be gated
# by a command at all, because the rest change prose rules no command can hold to
# account. A presence check is the strongest instrument available here, and calling
# it more than that would be the overstatement this whole slice exists to stop.
#
# What it does establish: a rule cannot be silently dropped. Deleting the premise
# gate, or softening "a `no` ends the item" into advice, turns this red.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
S="$REPO/plugins/ae/skills"

checked=0
failed=0
want() { # description, file, pattern
  checked=$((checked + 1))
  if ! grep -q "$3" "$2"; then
    echo "not ok: $1"
    failed=$((failed + 1))
  fi
}

# 1 — the premise verdict, and that a `no` stops rather than warns
want "analyze requires a Premise section"            "$S/analyze/SKILL.md" '## Premise (REQUIRED'
want "analyze asks whether the problem exists today" "$S/analyze/SKILL.md" 'exist \*\*today\*\*'
want "analyze asks whether it was decided the other way" "$S/analyze/SKILL.md" 'decided \*\*the other way\*\*'
want "analyze asks whether a command can answer it"  "$S/analyze/SKILL.md" 'answered by a \*\*command\*\*'
want "and a no ends the item rather than warning"    "$S/analyze/SKILL.md" 'ends the item'
want "the premise gate blocks finishing analysis.md" "$S/analyze/SKILL.md" 'Exit gate, part 1'

# 3 — the handover rule
want "analyze runs the next stage's checks first"    "$S/analyze/SKILL.md" 'run every check the next stage will run'
want "and says a person waits for a signature"       "$S/analyze/SKILL.md" 'never for a repair'

# 4 — criteria, not methods, with the test that separates them
want "plan states criteria rather than methods"      "$S/plan/SKILL.md" 'Criteria, not methods'
want "and gives the delete-the-clause test"          "$S/plan/SKILL.md" 'if the criterion is unchanged, it was a method'
want "and wants the check seen failing first"        "$S/plan/SKILL.md" 'seen failing before the work starts'

# 5 — quote the criterion before escalating
want "discuss checks whether it is already answered" "$S/discuss/SKILL.md" 'Is it already answered'
want "and whether evidence would settle it"          "$S/discuss/SKILL.md" 'Is it answerable by evidence'
want "and quotes the wording that reserves it"       "$S/discuss/SKILL.md" 'paste the wording that reserves the decision'
want "and names the subject in plain language"       "$S/discuss/SKILL.md" 'not by identifier'

# BL-217 — the boundaries, and the red-first chain that spans three stages
want "discuss carries a falsifier per decision"      "$S/discuss/SKILL.md" 'Falsifier'
want "and routes one it cannot name away from plan"  "$S/discuss/SKILL.md" 'does not go to plan'
want "plan lays the steps out as a stack"            "$S/plan/SKILL.md" 'dependency-ordered stack'
want "and each step declares whether it self-closes" "$S/plan/SKILL.md" 'Self-closing:'
want "and the falsifier is run red before the work"  "$S/plan/SKILL.md" 'it must be red'
want "and one observation belongs to no single step" "$S/plan/SKILL.md" 'whole-path observation'
want "work records the red run rather than doing it" "$S/work/SKILL.md" 'FALSIFIED_AC'
want "review reads that record"                      "$S/review/SKILL.md" 'FALSIFIED_AC'
want "and reports an AC never seen red"              "$S/review/SKILL.md" 'unfalsified'

echo "AE-SUBJECTS: $checked"
echo "$((checked - failed))/$checked rules present"
[ "$failed" -eq 0 ] || exit 1
