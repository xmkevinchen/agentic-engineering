#!/bin/sh
# test-declared-vs-effective.sh — F-082 AC6.
#
# Asserts `check-declared-vs-effective.sh` exits 0 on the clean tree AND non-zero on a seeded
# mismatch in each pair kind. The second half is the load-bearing one: a fail-closed check never
# observed failing is fail-closed by assertion only.
#
# **Each case is DIFFERENTIAL, and the first version of this test was worthless without it.**
# The subject derives its paths from its own location, so a seeded case runs in a throwaway
# mirror — and a mirror carrying no `agents/` directory makes the reachability delegate report
# six missed preconditions on its own. Every case therefore exited non-zero whether or not its
# mutation was detected, and a broken detector would have passed all four. So each case now
# compares the SAME staged tree before and after one mutation, and asserts the mutation's own
# failure signature appears only after. Ambient noise is present in both runs and cancels.
#
# Nothing under the real repository is mutated — a test that edits the working tree to prove a
# point is one interrupted run away from leaving the edit behind.
#
# Run: sh plugins/ae/tests/scripts/test-declared-vs-effective.sh

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SCRIPTS="$REPO/plugins/ae/scripts"
SUBJECT="$SCRIPTS/check-declared-vs-effective.sh"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

[ -f "$SUBJECT" ] || { bad "subject missing: $SUBJECT"; exit 1; }

# 1. Clean tree exits 0. This is the only case that runs against the real repository, and it is
#    read-only.
if sh "$SUBJECT" >/dev/null 2>&1; then
  ok "clean tree: exits 0"
else
  bad "clean tree: expected exit 0, got non-zero"
  sh "$SUBJECT" 2>&1 | tail -8 | sed 's/^/       /' >&2
fi

stage() { # -> echoes a staged root carrying what the subject reads
  root="$(mktemp -d)"
  mkdir -p "$root/plugins/ae/scripts" "$root/plugins/ae/tests/scripts" \
           "$root/plugins/ae/.claude-plugin" "$root/plugins/ae/mcp-servers/gemini"
  cp "$SUBJECT" "$root/plugins/ae/scripts/"
  for f in check-cast-block.sh check-shutdown-canonical.sh check-family-reachability.sh \
           check-agent-teams.sh check-cross-family.sh check-harness.sh check-proxy-residual.sh \
           read-family-table.py; do
    [ -f "$SCRIPTS/$f" ] && cp "$SCRIPTS/$f" "$root/plugins/ae/scripts/"
  done
  cp "$REPO/plugins/ae/tests/scripts/test-manifest-single-source.sh" \
     "$root/plugins/ae/tests/scripts/" 2>/dev/null
  printf '{"mcpServers":{"gemini":{"command":"bash"}}}\n' \
     > "$root/plugins/ae/.claude-plugin/plugin.json"
  echo "$root"
}

# differential <label> <signature> <mutation-command...>
#   Runs the staged subject before and after the mutation. Requires: the signature is absent
#   before, present after, and the exit status is non-zero after.
differential() {
  label=$1; signature=$2; shift 2
  W="$(stage)"
  SUBJ="$W/plugins/ae/scripts/check-declared-vs-effective.sh"

  before="$(sh "$SUBJ" 2>&1)"
  if printf '%s\n' "$before" | grep -qF "$signature"; then
    bad "$label: signature '$signature' is already present BEFORE the mutation — the case proves nothing"
    rm -rf "$W"; return
  fi

  ( cd "$W" && eval "$@" )

  after="$(sh "$SUBJ" 2>&1)"; status=$?
  if ! printf '%s\n' "$after" | grep -qF "$signature"; then
    bad "$label: mutation was NOT detected — signature '$signature' absent after seeding"
  elif [ "$status" -eq 0 ]; then
    bad "$label: signature reported but the check still exited 0 — it does not fail closed"
  else
    ok "$label"
  fi
  rm -rf "$W"
}

# Pair 1 — the same server declared in both manifests.
differential "pair 1 (manifest single-source): duplicate declaration fails closed" \
  "declared in more than one manifest" \
  "printf '{\"mcpServers\":{\"gemini\":{\"command\":\"bash\"}}}\n' > plugins/ae/.mcp.json"

# Pair 2/3 — the delegate is gone. Distinct from "the delegate found a mismatch": an
# unevaluable pair must redden the run, since a silently skipped pair is how a control stops
# being checked at all.
differential "pair 2/3 (declared tools + probes): a missing delegate fails closed, not skipped" \
  "delegate missing" \
  "rm -f plugins/ae/scripts/check-family-reachability.sh"

# Pair 4 — a new check script classified in neither list.
differential "pair 4 (check wiring): an unclassified check-*.sh fails closed" \
  "unclassified check" \
  "printf '#!/bin/sh\nexit 0\n' > plugins/ae/scripts/check-something-new.sh"

# Pair 4, second half — a listed lint that fails must redden the run. Without this, pair 4 would
# assert only that a script is listed, not that it is executed.
differential "pair 4 (check wiring): a failing corpus lint fails the run — the lint is executed" \
  "check-cast-block.sh — fails against the live tree" \
  "printf '#!/bin/sh\necho seeded\nexit 1\n' > plugins/ae/scripts/check-cast-block.sh"

# The script must state its fail-closed contract in its own header — AC6 greps for the phrase,
# and the decision row it implements had no artifact at all when it was written.
# AC6 greps for this exact phrase, so the assertion uses the same literal the AC does. An
# earlier version checked for "fails closed", which the AC's own `grep -rln "fail closed"` does
# not match — the test would have been green while the AC it implements was unsatisfiable.
grep -q "fail closed" "$SUBJECT" \
  && ok "subject states its fail-closed contract in the header, in the words AC6 greps for" \
  || bad "subject does not contain the literal 'fail closed' — AC6's own grep would not find it"

# It must not contact a backend: a declared-vs-effective check that needs a live model server
# would redden every machine without one, the regression AC7 names for the suite.
if grep -nE '(^|[^a-z-])(curl|wget|nc)[[:space:]]' "$SUBJECT" | grep -v '^[0-9]*:[[:space:]]*#' | grep -q .; then
  bad "subject appears to make a network call — it must stay runnable with every backend down"
else
  ok "subject makes no network call of its own"
fi

[ "$fail" = 0 ] && echo "test-declared-vs-effective: PASS" || echo "test-declared-vs-effective: FAIL" >&2
exit "$fail"
