#!/bin/sh
# ae-run-tests.sh — AE's full deterministic test suite (the pipeline.yml test.command target).
#
# Runs the structural skill-frontmatter check PLUS every shell test under tests/scripts/.
# Both halves matter: a gate that ran only the frontmatter check would stay green while a
# mechanism test was red.
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

run "skill frontmatter (structural)" "$HERE/check-skill-frontmatter.sh"

for t in "$SUITE"/test-*.sh; do
  [ -f "$t" ] || continue
  run "$(basename "$t")" "$t"
done

if [ "$fail" -eq 0 ]; then echo "[ae-tests] ALL GREEN"; else echo "[ae-tests] SOME FAILED"; fi
exit "$fail"
