#!/bin/sh
# test-family-add-cost.sh — F-082 AC11: what does the NEXT family actually cost?
#
# The claim under test is the feature's first criterion — adding a family should be cheap.
# An earlier draft of this AC asserted "strictly fewer than 4 files", where 4 was the cost of
# adding oMLX, measured exactly once. That turns a single observation into a permanent
# pass/fail line for a family that does not exist, and cannot tell "the generalisation worked"
# from "family #4 happened to be easy". So the assertion here is structural instead: a family
# on the generic seat is added by editing ONE file, and the test proves it by adding one and
# checking that nothing else had to change for it to become reachable.
#
# Run: sh plugins/ae/tests/scripts/test-family-add-cost.sh

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SCRIPTS="$REPO/plugins/ae/scripts"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
FIXTURE="$WORK/pipeline.yml"
cp "$REPO/.claude/pipeline.yml" "$FIXTURE"

# The whole cost of adding a family on the generic seat: one entry, in one file.
# A vendor endpoint is used deliberately — nothing is dialled during this test, and a
# reachability precondition is a static property, not a live probe.
cat >> "$FIXTURE" <<'YAML'
  fixture-family: { seat: openai-compat, family: fixturelineage, host: vendor, endpoint: "https://example.invalid/v1", model: fixture-model-1 }
YAML

before="$(cd "$REPO" && git status --porcelain | sort)"

out="$(AE_PIPELINE="$FIXTURE" "$SCRIPTS/check-family-reachability.sh" 2>&1)"
status=$?

if [ "$status" -eq 0 ] && printf '%s' "$out" | grep -q '0 missed'; then
  ok "a family added by one config entry reaches every precondition with no other edit"
else
  bad "the fixture family did not become reachable from a config entry alone:"
  printf '%s\n' "$out" | sed 's/^/       /' >&2
fi

if printf '%s' "$out" | grep -q 'fixture-family'; then
  ok "the new entry is enumerated by the reachability check (not silently skipped)"
else
  bad "reachability never mentioned fixture-family — it iterates something other than the table"
fi

after="$(cd "$REPO" && git status --porcelain | sort)"
if [ "$before" = "$after" ]; then
  ok "adding the family mutated no tracked file (cost is one entry in pipeline.yml)"
else
  bad "the working tree changed while adding a family — the cost is more than one config entry:"
  printf '%s\n' "$after" | sed 's/^/       /' >&2
fi

# Report, do not assert, the per-family file surface. A number recorded once is an
# observation; asserting a threshold against it is the n=1 error this AC was rewritten to
# avoid.
echo "  note: files a generic-seat family must touch = 1 (pipeline.yml). Seats with a named"
echo "        unique asset still cost a definition — that is the deciding property, not a budget."

if [ "$fail" -eq 0 ]; then echo "test-family-add-cost.sh: PASS"; else echo "test-family-add-cost.sh: FAIL" >&2; fi
exit "$fail"
