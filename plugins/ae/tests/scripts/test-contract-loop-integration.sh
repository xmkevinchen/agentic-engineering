#!/bin/sh
# test-contract-loop-integration.sh — F-049 AC5: the contract runner feeds the F-048
# verdict loop. A contract failure (test.command non-0) overrides a PASSING review →
# loop-decide dispatches fixup. Uses the REAL scripts (parse-review-verdict, loop-decide,
# verify-contract) — dogfoods the deterministic-end THROUGH the loop, not in isolation.
set -u
HERE=$(dirname "$0")
SCRIPTS="$HERE/../../scripts"
PARSE="$SCRIPTS/parse-review-verdict.sh"
DECIDE="$SCRIPTS/loop-decide.sh"
RUNNER="$SCRIPTS/verify-contract.sh"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0

# A review that PASSED (verdict: pass in frontmatter).
printf -- '---\nverdict: pass\n---\n# review\nlooks good\n' > "$tmp/review.md"
verdict=$(sh "$PARSE" "$tmp/review.md")
[ "$verdict" = "pass" ] || { echo "FAIL: parse expected pass got '$verdict'"; fail=1; }

# Contract spec + VIOLATING data (the F-048 test.command hedge).
printf 'all(.amounts[]; . >= 0 and . <= 100)\n' > "$tmp/spec.jq"
echo '{"amounts":[999]}' > "$tmp/bad.json"
if sh "$RUNNER" "$tmp/spec.jq" "$tmp/bad.json" >/dev/null 2>&1; then
  echo "FAIL: contract should have failed on violating data"; fail=1
else
  verdict=fail   # SIMULATES the F-048 hedge: in /ae:work this conversion (test.command
                 # non-0 → verdict=fail) is LLM-executed prompt logic, not shell-callable,
                 # so we hand-set it here. This test covers the deterministic skeleton, not
                 # the LLM seam (codex M2 + challenger Ch2 — scope is honest, not end-to-end).
fi
action=$(sh "$DECIDE" "$verdict" 0 3)
if [ "$action" = "dispatch_fixup" ]; then
  echo "ok: passing review + contract-FAIL (test.command non-0) → verdict=fail → $action"
else
  echo "FAIL: expected dispatch_fixup got '$action'"; fail=1
fi

# Control: contract PASSES on conforming data → passing review stands → exit_pass.
echo '{"amounts":[50]}' > "$tmp/ok.json"
if sh "$RUNNER" "$tmp/spec.jq" "$tmp/ok.json" >/dev/null 2>&1; then v2=pass; else v2=fail; fi
a2=$(sh "$DECIDE" "$v2" 0 3)
if [ "$a2" = "exit_pass" ]; then
  echo "ok: passing review + contract-PASS → verdict=pass → $a2"
else
  echo "FAIL: control expected exit_pass got '$a2'"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; exit 1; fi
