#!/bin/sh
# test-f067-small-critical.sh — F-067 AC4: a SMALL diff in a security-sensitive file
# still fires the risk-floor (provenance: the deterministic floor forces `security`,
# NOT the LLM soft-add). The floor is path-based, so a 3-line permission change is
# treated identically to a large one — closing the gap where an LLM stat-read judges
# a small auth change "minor" and omits the security lens.
#
# This is the deterministic half of AC4: it exercises risk-floor-lenses.sh (the producer
# of the `risk_floor_lenses` trace field) directly. The full "appears in risk_floor_lenses
# specifically, not just final_lenses" provenance assertion is wired in review/SKILL.md.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SUT="$HERE/../../scripts/risk-floor-lenses.sh"
fail=0
tmp=$(mktemp -d)

cat > "$tmp/patterns" <<'EOF'
auth/*
security/*
migrations/*
*secret*
EOF

# Simulate a SMALL (3-line) change to a security-sensitive file: the input to the floor is
# the changed PATH, not the diff size — that is the point. One path, security-sensitive.
printf 'auth/middleware.go\n' > "$tmp/paths"
got=$(sh "$SUT" "$tmp/paths" "$tmp/patterns" 2>/dev/null)
if [ "$got" = "security" ]; then
  echo "ok: small auth-file change → risk_floor forces security (size-independent)"
else
  echo "FAIL: expected [security] got [$got]"; fail=1
fi

# Negative control: a small change to a NON-sensitive file does NOT force the floor
# (so the floor isn't trivially always-on — it's the glob match that matters).
printf 'src/ui/button.go\n' > "$tmp/paths"
got=$(sh "$SUT" "$tmp/paths" "$tmp/patterns" 2>/dev/null)
[ -z "$got" ] && echo "ok: small non-sensitive change → no floor forced" || { echo "FAIL: non-sensitive should be empty, got [$got]"; fail=1; }

rm -rf "$tmp"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
