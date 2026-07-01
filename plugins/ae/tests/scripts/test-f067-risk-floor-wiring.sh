#!/bin/sh
# test-f067-risk-floor-wiring.sh — F-067 fixup (C-P1 + F2/C-P2b): guard the §0 risk-floor WIRING
# in review/SKILL.md, not just the helper script in isolation. The iter-0 review caught that the
# helper passed every unit test while §0 was inert in pipeline mode (it diffed the raw <target> =
# plan path). This test goes red if §0 (a) stops invoking the helper, (b) reverts to diffing the
# raw <target> instead of the computed review scope, or (c) stops writing risk_floor_lenses —
# closing the "a regression removing §0 passes all tests" gap.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SKILL="$HERE/../../skills/review/SKILL.md"
fail=0

check() { # label  pattern
  if grep -qiE "$2" "$SKILL"; then echo "ok: $1"; else echo "FAIL: $1 — pattern not found: $2"; fail=1; fi
}
absent() { # label  pattern  (must NOT appear)
  if grep -qiE "$2" "$SKILL"; then echo "FAIL: $1 — forbidden pattern present: $2"; fail=1; else echo "ok: $1"; fi
}

# §0 invokes the helper script
check  "§0 invokes risk-floor-lenses.sh"            'risk-floor-lenses\.sh'
# §0 uses the COMPUTED review scope, not the raw <target>
check  "§0 diffs the computed REVIEW_SCOPE"          'git diff --name-only "\$REVIEW_SCOPE"'
# §0 explicitly warns against diffing the raw <target> (the C-P1 bug)
check  "§0 warns <target> is the plan path (C-P1)"   '<target> is the PLAN PATH|Do NOT diff the raw <target>'
# the forbidden inert form must NOT reappear
absent "§0 no longer diffs raw <target>"             'git diff --name-only <target>'
# §0 feeds the floor output into the risk_floor_lenses provenance field
check  "§0 produces risk_floor_lenses"               'risk_floor_lenses'
# P1-b (integration review): §0 must NOT invoke via an undefined $AE_PLUGIN path — that
# form is inert everywhere $AE_PLUGIN is unset (i.e. everywhere), silently disabling the floor.
absent "§0 has no undefined \$AE_PLUGIN path (P1-b)"  'AE_PLUGIN'
# P1-b: the bin/ symlink must exist so the bare `risk-floor-lenses.sh` call actually resolves on PATH
BIN="$HERE/../../bin/risk-floor-lenses.sh"
if [ -f "$BIN" ]; then echo "ok: bin/risk-floor-lenses.sh resolves on PATH (bare call live)"; else echo "FAIL: bin/risk-floor-lenses.sh missing — §0 bare call inert"; fail=1; fi

[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
