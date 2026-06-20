#!/bin/sh
# loop-decide.sh — F-048: the back-half leash loop's PURE decision function.
#
# (verdict, iteration, cap) -> action. NO LLM, NO file mutation, NO `claude -p` — only the
# loop arithmetic. This is the deterministic *skeleton*; the judgment (the work, the verdict)
# stays in the LLM-driven work/review steps that the /ae:loop driver chains. Keeping this a
# pure shell function is what makes the loop's halting invariant unit-testable.
#
# Usage:  loop-decide.sh <verdict> <iteration> <cap>
#   verdict   ∈ {pass, fail, invalid}   (invalid = parse-review-verdict couldn't classify)
#   iteration = completed fixup attempts, zero-indexed integer >= 0
#   cap       = max fixup attempts, integer >= 1
#
# Output (stdout, exit 0):
#   pass                       -> exit_pass
#   fail|invalid, iter <  cap  -> dispatch_fixup
#   fail|invalid, iter >= cap  -> escalate_cap
#   (invalid additionally warns on stderr — a distinct diagnostic, not silent)
# Usage / bad input (wrong argc, unknown verdict, non-int, negative iter, cap < 1):
#   one-line message on stderr, exit 2, nothing on stdout.
set -u

if [ "$#" -ne 3 ]; then
  echo "usage: loop-decide.sh <pass|fail|invalid> <iteration> <cap>" >&2
  exit 2
fi
verdict=$1
iter=$2
cap=$3

# integer validation (a leading '-' contains a non-digit, so negatives are rejected here too)
case $iter in ''|*[!0-9]*) echo "loop-decide.sh: iteration not a non-negative integer: $iter" >&2; exit 2;; esac
case $cap  in ''|*[!0-9]*) echo "loop-decide.sh: cap not a positive integer: $cap" >&2; exit 2;; esac
[ "$cap" -ge 1 ] || { echo "loop-decide.sh: cap must be >= 1: $cap" >&2; exit 2; }

case $verdict in
  pass)    echo exit_pass; exit 0 ;;
  fail)    ;;
  invalid) echo "loop-decide.sh: invalid verdict treated as fail" >&2 ;;
  *)       echo "loop-decide.sh: unknown verdict: $verdict (expected pass|fail|invalid)" >&2; exit 2 ;;
esac

# verdict is fail or invalid:
if [ "$iter" -lt "$cap" ]; then
  echo dispatch_fixup
else
  echo escalate_cap
fi
exit 0
