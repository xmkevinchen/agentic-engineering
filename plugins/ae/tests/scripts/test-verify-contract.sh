#!/bin/sh
# test-verify-contract.sh — F-049 AC4: the jq contract runner rejects weak/violating
# data and passes boundary-correct data (NOT toy-passes-anything — gemini AC6).
set -u
HERE=$(dirname "$0")
RUNNER="$HERE/../../scripts/verify-contract.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

# Strict business-data spec: a range invariant + a uniqueness invariant.
cat > "$tmp/spec.jq" <<'EOF'
# business-data invariants (boundary-exercising, not midpoint-trivial)
all(.amounts[]; . >= 0 and . <= 100)
(.ids | length) == (.ids | unique | length)
EOF

# conforming: exercises the exact boundaries 0 and 100, ids unique
echo '{"amounts":[0,100,50],"ids":[1,2,3]}'   > "$tmp/ok.json"
# violating range: 101 > 100
echo '{"amounts":[101],"ids":[1,2,3]}'        > "$tmp/bad_range.json"
# violating range: -1 < 0
echo '{"amounts":[-1,50],"ids":[1,2,3]}'      > "$tmp/bad_low.json"
# violating uniqueness: duplicate id
echo '{"amounts":[50],"ids":[1,1,2]}'         > "$tmp/bad_uniq.json"

assert_exit() { # desc expected-exit sample
  sh "$RUNNER" "$tmp/spec.jq" "$3" >/dev/null 2>&1
  got=$?
  if [ "$got" -eq "$2" ]; then echo "ok: $1 (exit $got)"; else echo "FAIL: $1 — expected $2 got $got"; fail=1; fi
}

assert_exit "boundary-correct data passes"   0 "$tmp/ok.json"
assert_exit "out-of-range (high) data fails" 1 "$tmp/bad_range.json"
assert_exit "out-of-range (low) data fails"  1 "$tmp/bad_low.json"
assert_exit "duplicate-id data fails"        1 "$tmp/bad_uniq.json"

# usage / IO errors → exit 2
sh "$RUNNER" "$tmp/spec.jq" >/dev/null 2>&1
[ $? -eq 2 ] && echo "ok: usage error exit 2" || { echo "FAIL: usage error not 2"; fail=1; }
sh "$RUNNER" "$tmp/nope.jq" "$tmp/ok.json" >/dev/null 2>&1
[ $? -eq 2 ] && echo "ok: missing-spec exit 2" || { echo "FAIL: missing-spec not 2"; fail=1; }

if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; exit 1; fi
