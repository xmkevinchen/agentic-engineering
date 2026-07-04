#!/bin/sh
# The grounded-verification contract for fact-claim judge ACs is wired on all
# four surfaces: plan authoring rule, analyze table guidance, plan-review
# strength check, review Check 7 execution contract.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

has(){ # $1 file, $2 pattern, $3 label
  if grep -q "$2" "$1"; then ok "$3"; else notok "$3"; fi
}

P="$SKILLS/plan/SKILL.md"
has "$P" 'judge-class: fact-claim | form' "plan: discriminator declared in the authoring rule"
has "$P" 'the source set.* the judge reads FIRST' "plan: fact-claim requires a source set read first"
has "$P" 'claim-by-claim output shape' "plan: fact-claim requires the claim-by-claim output shape"
has "$P" 'cross-family / fresh-context judging when the judged artifact is self-authored' "plan: fact-claim requires cross-family for self-authored"
has "$P" 'MATERIAL claims (architectural, causal, normative, comparative) are checked exhaustively' "plan: material-claim tiering present"
has "$P" 'source access > claim-by-claim output shape > judge independence > rubric wording' "plan: lever priority stated"

A="$SKILLS/analyze/SKILL.md"
has "$A" 'judge (fact-claim)' "analyze: class annotation in the verify_by cell"
has "$A" 'sketch of the source set' "analyze: fact-claim rows sketch the source set"

R="$SKILLS/plan-review/SKILL.md"
has "$R" 'judge-class: fact-claim | form' "plan-review: class declaration checked"
has "$R" "artifact's self-consistency alone" "plan-review: self-consistency-only fact-claim rubric is rejected"
has "$R" 'No class on a NEW plan' "plan-review: missing class on a new plan is Must fix"
has "$R" 'A `form`-class AC with a one-question rubric passes untouched' "plan-review: form ACs stay cheap"

C="$SKILLS/review/SKILL.md"
has "$C" 'judge-class: fact-claim` execution contract' "review: Check 7 carries the execution contract"
has "$C" 'named source set BEFORE the artifact' "review: two-pass source-first order"
has "$C" 'per-claim verdicts' "review: claim-by-claim verdict records required"
has "$C" 'cross-family, fresh-context judge' "review: self-authored artifacts get an independent judge"
has "$C" 'judge-class: form` ACs keep the one-question evaluation' "review: form ACs exempt from the source pass"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
