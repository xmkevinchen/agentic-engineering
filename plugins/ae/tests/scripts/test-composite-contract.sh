#!/bin/sh
# test-composite-contract.sh — F-098.
#
# AC1 and AC4 of F-098 have mechanical falsifiers: a composite whose content changed after the
# round that attacked it, and a material point carrying no disposition. AC3 has a mechanical
# half — a criterion nobody was equipped to check is unexamined, not met.
#
# check-composite.py is the implementation of those falsifiers. This asserts it fires on each
# one separately, so a checker that silently stops checking one thing is visible.
#
# It does NOT check AC2. That falsifier asks whether a seat's claim reached the composite with a
# stated reason, which no parse decides; plan.md names a judged check for it instead.
#
# Run: sh plugins/ae/tests/scripts/test-composite-contract.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
CHECK="$REPO/plugins/ae/scripts/check-composite.py"
FIX="$REPO/plugins/ae/tests/fixtures/composite"

passed=0
failed=0

ok() {
  passed=$((passed + 1))
  echo "  ok: $1"
}

bad() {
  failed=$((failed + 1))
  echo "  FAIL: $1" >&2
  [ -n "${2:-}" ] && echo "       $2" >&2
  return 0
}

if [ ! -f "$CHECK" ]; then
  echo "  FAIL: missing file: plugins/ae/scripts/check-composite.py" >&2
  echo "       the criteria's falsifiers have no implementation" >&2
  echo
  echo "  0 passed, 1 failed"
  exit 1
fi

# A fixture that obeys every rule must pass, or every failure below proves nothing.
if python3 "$CHECK" "$FIX/clean/round-2/composite.md" >/dev/null 2>&1; then
  ok "a composite obeying every rule exits 0"
else
  bad "the clean fixture does not pass" "$(python3 "$CHECK" "$FIX/clean/round-2/composite.md" 2>&1)"
fi

# A point whose mark or citation sits on a continuation line still obeys the rule. Reading only
# the line an item opens with reported violations against a correct composite — observed on a real
# run, not imagined.
if python3 "$CHECK" "$FIX/wrapped/round-2/composite.md" >/dev/null 2>&1; then
  ok "a point that wraps is read whole, mark and citation wherever the prose put them"
else
  bad "a wrapped point is judged on its opening line alone" "$(python3 "$CHECK" "$FIX/wrapped/round-2/composite.md" 2>&1)"
fi

# AC4 — a material point with no disposition.
out=$(python3 "$CHECK" "$FIX/unmarked/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "mark"; then
  ok "AC4: an unmarked material point is reported"
else
  bad "AC4: unmarked items were not reported" "$out"
fi

# AC1 — content changed after the round that attacks it was spawned.
out=$(python3 "$CHECK" "$FIX/stale-freeze/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "frozen\|sha256"; then
  ok "AC1: a composite edited after round three was spawned is reported"
else
  bad "AC1: the freeze violation was not reported" "$out"
fi

# A seat file named what the host loads as instructions turns that seat's answer into a directive
# for every later agent reading the directory, and round one stops being blind. Nothing in the
# artifact shows it — the file is a well-formed seat answer under an allowed-looking name.
out=$(python3 "$CHECK" "$FIX/host-collision/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "instructions"; then
  ok "a seat file named what the host loads as instructions is reported"
else
  bad "a host-loaded filename passed" "$out"
fi

# AC1 — round three was spawned but no digest was ever recorded. A freeze nobody wrote down is
# not a freeze: the composite could then be edited freely and the check would report nothing.
out=$(python3 "$CHECK" "$FIX/unfrozen/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "FROZEN"; then
  ok "AC1: a spawned round three with no recorded digest is reported"
else
  bad "AC1: a missing FROZEN passed silently" "$out"
fi

# AC3 — a point characterising what the round established, citing no source. AC3's falsifier is
# "differs from what the seat files say about it, OR that cites no source"; the second half needs
# a check of its own.
out=$(python3 "$CHECK" "$FIX/uncited/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "cites no source"; then
  ok "AC3: a survived point citing no seat file is reported"
else
  bad "AC3: an uncited characterisation passed" "$out"
fi

# AC3 (mechanical half) — no close-out angle held the seat-file paths.
out=$(python3 "$CHECK" "$FIX/unwitnessed/round-2/composite.md" 2>&1)
if [ $? -ne 0 ] && echo "$out" | grep -qi "given_seat_file_paths"; then
  ok "AC3: a composite no angle was equipped to audit is reported"
else
  bad "AC3: the unwitnessed composite was not reported" "$out"
fi

echo
echo "  $passed passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
