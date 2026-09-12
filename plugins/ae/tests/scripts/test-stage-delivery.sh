#!/usr/bin/env bash
# test-stage-delivery.sh — run check-stage-delivery.py over the fixtures under
# tests/fixtures/stage-delivery/ and assert what it says, not merely that it said something.
#
# Every fixture is a feature directory sitting under a state directory, so the checker resolves
# the features root the same way it does on a real tree: <fixture>/<state>/<F-NNN-slug>/.
#
# expect_ok   <fixture> <stage>              — exit 0
# expect_bad  <fixture> <stage> <substr>...  — exit 1, and every substring present in the output
#
# A substring is asserted rather than a count because the criterion the messages serve asks that
# a reader can finish the missing part without running the stage again; "output was non-empty"
# would pass on a message that names nothing.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# The checker under test. `CHECK_UNDER_TEST` lets a caller point the suite at a copy, which is
# how the mutation sweep runs without writing the file everyone else in the tree is reading.
CHECK="${CHECK_UNDER_TEST:-$ROOT/plugins/ae/scripts/check-stage-delivery.py}"
FIXTURES="$ROOT/plugins/ae/tests/fixtures/stage-delivery"

passed=0
failed=0

fixture_dir() {
  # a fixture holds exactly one feature directory, under whichever state directory it uses
  find "$FIXTURES/$1" -mindepth 2 -maxdepth 2 -type d | sort | head -1
}

report() {
  if [ "$1" = pass ]; then
    passed=$((passed + 1))
    printf '  ok   %s\n' "$2"
  else
    failed=$((failed + 1))
    printf '  FAIL %s\n' "$2"
    printf '%s\n' "$3" | sed 's/^/       /'
  fi
}

expect_ok() {
  local fixture=$1 stage=$2 dir out code missing=""
  shift 2
  dir=$(fixture_dir "$fixture")
  out=$(python3 "$CHECK" "$dir" "$stage" 2>&1)
  code=$?
  if [ "$code" -ne 0 ]; then
    report fail "$fixture ($stage) exits 0" "exit $code
$out"
    return
  fi
  # exit 0 is not silent: it states what it did not decide, so the code is not read as conformance
  for needle in "$@"; do
    case "$out" in
      *"$needle"*) ;;
      *) missing="$missing
  says nothing about: $needle" ;;
    esac
  done
  if [ -z "$missing" ]; then
    report pass "$fixture ($stage) exits 0"
  else
    report fail "$fixture ($stage) exits 0 and states its coverage" "$missing

$out"
  fi
}

expect_bad() {
  local fixture=$1 stage=$2 dir out code missing=""
  shift 2
  dir=$(fixture_dir "$fixture")
  out=$(python3 "$CHECK" "$dir" "$stage" 2>&1)
  code=$?
  if [ "$code" -ne 1 ]; then
    report fail "$fixture ($stage) exits 1" "exit $code
$out"
    return
  fi
  # Match against the message with every path under the fixtures root taken out, not only the
  # directory under test. A needle that is also a word in some fixture's path is otherwise
  # satisfied by the path the message prints rather than by anything the message says — observed
  # three times: `sequence` against a fixture named discuss-sequence, `verdict` against
  # review-no-verdict-line, and `F-240` against the *sibling* holder the collision message names,
  # which stripping only the directory under test left standing with its id intact.
  # A file's basename stays: naming the deliverable is half of what these messages owe. A
  # directory's does not, because that is where a feature id lives.
  said=$(printf '%s' "$out" | sed -E \
    -e "s|$FIXTURES[^ ,]*/([^ ,/]*\.md)|<dir>/\1|g" \
    -e "s|$FIXTURES[^ ,]*|<dir>|g")
  # every failing run ends with its own count, and that line is a message site like any other
  for needle in "problem(s)" "$@"; do
    case "$said" in
      *"$needle"*) ;;
      *) missing="$missing
  message never says: $needle" ;;
    esac
  done
  if [ -z "$missing" ]; then
    report pass "$fixture ($stage) exits 1 and names what is wrong"
  else
    report fail "$fixture ($stage) exits 1 and names what is wrong" "$missing

$out"
  fi
}

echo "ANALYZE — a legitimate ending is distinguishable from an interrupted run"
expect_ok  analyze-delivered      analyze  "Not decided here" "not \"the stage conformed\""
expect_ok  analyze-blocked        analyze
expect_ok  analyze-nothing-to-do  analyze
expect_ok  analyze-not-one-item   analyze
expect_bad analyze-empty-analysis analyze  analyze analysis.md empty "work item"
expect_bad analyze-interrupted    analyze \
  analyze acceptance.md ended: nothing-to-do

echo "AC4 — the artifact on disk decides, not an account of it"
expect_bad analyze-interrupted-with-claiming-log analyze \
  analyze acceptance.md ended:

echo "PLAN, WORK, REVIEW — the same distinction, one deliverable each"
expect_ok  plan-delivered            plan
expect_ok  plan-criterion-unplannable plan
expect_ok  plan-check-green-first    plan
expect_ok  plan-input-refused        plan
expect_bad plan-interrupted          plan   plan "plan.md" ended: criterion-unplannable

expect_ok  work-delivered            work
expect_ok  work-blocked              work
expect_ok  work-criterion-defective  work
expect_bad work-interrupted          work   work "log.md" ended: blocked

expect_ok  review-delivered          review
expect_ok  review-blocked            review
expect_bad review-interrupted        review review "review.md" ended: blocked

echo "REVIEW — the verdict is bound to a reader file, not merely pointed at one"
expect_bad review-no-verdict-from                    review review "review.md" verdict_from
expect_bad review-verdict-not-bound                  review review "review.md" verdict
expect_ok  review-verdict-bound                      review
expect_bad review-reader-missing-receipt             review review "claude-subagent.md" agent_id
expect_ok  review-reader-with-receipt                review
expect_bad review-reader-cross-family-missing-receipt review review "cross-family.md" RECEIPT
expect_ok  review-reader-cross-family-with-receipt   review

echo "DISCUSS — the ids in the analysis minus the files on disk"
expect_ok  discuss-delivered      discuss
expect_ok  discuss-returned       discuss
expect_ok  discuss-none           discuss
expect_bad discuss-missing-record discuss  discuss Q2 decision-Q2.md
expect_bad discuss-empty-record   discuss  discuss Q1 decision-Q1.md empty

echo "ANALYZE — a deliverable that exists and does not conform"
expect_ok  analyze-criterion-judgement    analyze
expect_ok  analyze-delivered-still-blocked analyze
expect_ok  analyze-criterion-prose        analyze
expect_ok  analyze-criterion-headings     analyze
expect_bad analyze-ended-invented         analyze  analyze "is not an ending this stage has" done
expect_bad analyze-id-collision           analyze  analyze F-240 "held by"
expect_bad analyze-criterion-no-falsifier analyze  analyze acceptance.md AC2 falsifier
expect_bad analyze-no-criterion-ids       analyze  analyze acceptance.md "no criterion id" "AC1 — the property"

echo "PLAN, WORK, REVIEW — a deliverable that exists and leaves a criterion unaccounted for"
expect_bad plan-criterion-uncited   plan   plan   "plan.md"   AC3
expect_bad work-criterion-unlogged  work   work   "log.md"    AC3
expect_bad review-criterion-unjudged review review "review.md" AC3
expect_bad review-no-verdict-line   review review "review.md" verdict

echo "A shape the parser cannot read is unreadable, not empty"
expect_bad discuss-sequence            discuss  discuss "discuss:" sequence
expect_bad analyze-criterion-shape     analyze  analyze AC2 AC3 "is labelled with"
expect_bad analyze-blocked-by-scalar   analyze  analyze "blocked_by:" mapping
expect_bad analyze-frontmatter-not-first analyze analyze "byte 0"

echo "A criterion the checker cannot read is uncounted wherever criteria are counted"
expect_bad criterion-shape-unread-downstream plan   plan   "acceptance.md" AC2 AC3 "is labelled with"
expect_bad criterion-shape-unread-downstream work   work   "acceptance.md" AC2 AC3 "is labelled with"
expect_bad criterion-shape-unread-downstream review review "acceptance.md" AC2 AC3 "is labelled with"

echo "An item a review sent back is accounted for in the log that answers it"
expect_bad work-return-item-unaccounted work work "log.md" 1.1 "1.md"

echo "A stage marked blocked says what it is blocked on"
expect_bad work-blocked-nothing-stated   work   work   "log.md"    blocked_by:
expect_bad review-blocked-nothing-stated review review "review.md" blocked_by:

echo "A review that says it reached no verdict has not reached one"
expect_bad review-verdict-tbd     review  review "review.md" verdict
expect_bad review-verdict-negated review  review "review.md" verdict

echo "An absent directory says which of two things it is"
# A directory missing from a features root that exists, and a path that resolves nowhere, need
# opposite answers — send the stage back, or fix the argument. Constructed rather than
# fixtured: the case is a directory that is not there, which nothing can commit.
absent_under_root=$(python3 "$CHECK" "$FIXTURES/analyze-delivered/active/F-999-never-written" analyze 2>&1)
absent_root=$(python3 "$CHECK" "/nowhere-at-all/active/F-999-never-written" analyze 2>&1)
case "$absent_under_root" in
  *"stage wrote no feature directory"*"different id"*)
    report pass "absent under a real features root reads as the stage's" ;;
  *) report fail "absent under a real features root reads as the stage's" "$absent_under_root" ;;
esac
case "$absent_root" in
  *"path handed in wrong"*)
    report pass "a path resolving nowhere reads as the argument's" ;;
  *) report fail "a path resolving nowhere reads as the argument's" "$absent_root" ;;
esac

echo "Every message the checker can print, the suite can tell apart"
expect_bad analyze-ended-sequence         analyze  analyze "ended:" sequence
expect_bad analyze-ended-blank            analyze  analyze "ended:" "no value"
expect_bad plan-frontmatter-not-first     plan     plan    "byte 0"
expect_bad analyze-no-analysis            analyze  analyze analysis.md absent
expect_bad analyze-no-analysis            discuss  discuss analysis.md "discuss:"
expect_bad analyze-no-analysis            plan     plan    plan.md
expect_bad analyze-interrupted            plan     plan    acceptance.md "unchecked rather than confirmed"
expect_bad analyze-ended-with-acceptance  analyze  analyze "nothing-to-do" "one of the two is wrong"
expect_bad analyze-blockers-not-marked    analyze  analyze blocked_by: B1 "mid-loop"
expect_bad analyze-frontmatter-not-first  discuss  discuss "byte 0"
expect_bad discuss-no-field               discuss  discuss "no \`discuss:\` field"
expect_bad discuss-scalar                 discuss  discuss "not a list of ids"
expect_bad analyze-bad-dir-name           analyze  analyze "F-NNN-<slug>"

# Two more the checker can print that no fixture directory reaches: a directory outside the four
# state directories, and the usage line. Constructed, like the absent-directory cases.
loose=$(mktemp -d)
mkdir -p "$loose/F-999-loose"
printf -- '---\ndiscuss: {}\n---\n\n# Analysis\n\nStated.\n' > "$loose/F-999-loose/analysis.md"
printf -- '# Acceptance\n\n**AC1 — A property.**\nFalsifier: its absence.\n' > "$loose/F-999-loose/acceptance.md"
outside=$(python3 "$CHECK" "$loose/F-999-loose" analyze 2>&1)
rm -rf "$loose"
case "$outside" in
  *"does not sit under one of"*"unchecked rather than confirmed"*)
    report pass "a directory outside the state directories says its ids are unchecked" ;;
  *) report fail "a directory outside the state directories says its ids are unchecked" "$outside" ;;
esac

usage=$(python3 "$CHECK" 2>&1); usage_code=$?
case "$usage_code:$usage" in
  2:*usage:*) report pass "wrong arguments exit 2 with a usage line" ;;
  *) report fail "wrong arguments exit 2 with a usage line" "exit $usage_code
$usage" ;;
esac

echo "The message does not go away by being read"
# The same directory twice: reported, then the named gap closed, then reported on again. This is
# what "the missing part is completed before the next stage begins" rests on — the check is not
# an announcement the session agent can acknowledge past, it stays red until the file exists.
work=$(mktemp -d)
# the whole fixture, state directory and all: the checker resolves the features root from the
# feature directory's parents, so a copy that keeps only the leaf is not the same input
cp -R "$FIXTURES/analyze-interrupted-then-completed/." "$work/"
under_test="$work/active/F-260-then-completed"
before=$(python3 "$CHECK" "$under_test" analyze 2>&1); before_code=$?
cp "$work/completion/acceptance.md" "$under_test/"
after=$(python3 "$CHECK" "$under_test" analyze 2>&1); after_code=$?
rm -rf "$work"
if [ "$before_code" -eq 1 ] && [ "$after_code" -eq 0 ]; then
  report pass "analyze-interrupted-then-completed: red until the named file exists, then green"
else
  report fail "analyze-interrupted-then-completed: red until the named file exists, then green" \
    "before: exit $before_code
$before
after: exit $after_code
$after"
fi

echo
printf '%d passed, %d failed\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
