#!/bin/sh
# ae-run-tests.sh — AE's full deterministic test suite (the pipeline.yml test.command target).
#
# Runs the L1 oracle PLUS every shell mechanism test under tests/scripts/, so the F-048
# harness loop's deterministic hedge actually exercises the verdict parser, loop-decide,
# the contract runner, and the loop-integration — not just the SKILL frontmatter check.
# (test.command was L1-only, so those scripts could be red while the gate
# stayed green, undermining the deterministic-safety claim.)
#
# Exit: 0 = all green | 1 = at least one failure.
set -u
HERE=$(dirname "$0")
SUITE="$HERE/../tests/scripts"
fail=0
run() { # label  script  [args...]
  label=$1; shift
  printf '[ae-tests] %-42s ' "$label"
  if sh "$@" >/dev/null 2>&1; then echo PASS; else echo FAIL; fail=1; fi
}

run "L1 oracle (skill frontmatter)" "$HERE/ae-test-plugin-regression-layer1.sh"
for t in "$SUITE"/test-*.sh; do
  [ -f "$t" ] || continue
  run "$(basename "$t")" "$t"
done

if [ "$fail" -eq 0 ]; then echo "[ae-tests] ALL GREEN"; else echo "[ae-tests] SOME FAILED"; fi
exit "$fail"
