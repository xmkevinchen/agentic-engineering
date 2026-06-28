#!/bin/sh
# test-f067-ceremony-minimal.sh — F-067 AC6: `ceremony: minimal` is the ONLY path that
# drops the review floor, and there is NO automatic trivial-detector (user decision 2b).
# Deterministic regression guard on review/SKILL.md.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SKILL="$HERE/../../skills/review/SKILL.md"
fail=0

check() { # label  pattern
  if grep -qiE "$2" "$SKILL"; then echo "ok: $1"; else echo "FAIL: $1 — pattern not found: $2"; fail=1; fi
}
absent() { # label  pattern  (must NOT appear — guards against an auto-detector creeping in)
  if grep -qiE "$2" "$SKILL"; then echo "FAIL: $1 — forbidden pattern present: $2"; fail=1; else echo "ok: $1"; fi
}

check  "ceremony:minimal is the floor-drop override" 'ceremony: minimal.*manual override'
check  "minimal is the ONLY sub-floor path"          'ONLY way to drop below the floor'
check  "explicitly no auto trivial-detector"         'NO automatic trivial-detector'
# light/full must NOT be wired to drop the floor (only minimal)
check  "light/full do not drop the floor"            'light.*full.* do NOT drop the floor'

[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
