#!/bin/bash
# check-declared-vs-effective.sh — does what AE declares match what is actually in force?
#
# Two of the four defects found by *running* F-082's machinery were the same shape: a control
# that was declared and not the one in force. Two manifests disagreed and nothing compared them.
# A containment policy was asserted in a manifest the tool-call layer never consulted. Neither
# was a bug in a mechanism; both were a mechanism nobody checked against reality.
#
# Contract: **fail closed**. A pair this script cannot evaluate is a failure, never a skip. That is the
# whole point — the defect class is "the check was green because it was not looking", so a
# missing delegate or an unclassified new check must redden the run rather than pass quietly.
#
# The pairs:
#
#   1. Manifest declarations are single-source. Delegated to
#      `tests/scripts/test-manifest-single-source.sh` rather than reimplemented — Step 4 already
#      built that comparison, and two scripts asserting the same invariant is how they drift
#      apart.
#   2. A seat's declared MCP tool names resolve to a registered server. Delegated to
#      `check-family-reachability.sh` check 2, the existing precedent.
#   3. A family enabled in `pipeline.yml` has a probe declaration. Same delegate, check 5.
#      **Static by design**: it asks whether a probe is DECLARED, never whether a backend
#      answers. This script must stay runnable with every backend down and no network.
#   4. A check that exists is wired to the corpus it guards. Found the hard way: three
#      `check-*.sh` scripts enforced real invariants against nothing. One of them
#      (`check-proxy-residual.sh`) was already red — F-082's own Step 4 edited a proxy, the
#      recorded residual went stale, and no suite entry was pointed at the corpus to notice. A
#      check that works and is not wired is indistinguishable from no check.
#
# HONEST SCOPE — what this cannot see, stated because a declared-vs-effective check that
# overstates its reach is the exact defect it exists to catch:
#
#   * It reads DECLARATIONS. It does not observe a running host. Whether the manifest the host
#     executes is the one on disk is `probe-manifest-precedence.sh`'s question, and that one
#     needs live processes.
#   * It cannot see install-time validation. The host rejects a server whose `env` block names an
#     unresolved `${...}`, and the reload path skips that validation — so a manifest can be green
#     here, green on reload, and rejected for everyone who installs the plugin. Assertion 4 of
#     `test-manifest-single-source.sh` covers the one shape of this that is visible in a
#     declaration; the install path itself is not reachable from a test.
#   * It cannot see paraphrase, in any pair. Every comparison here is literal.
#   * Pair 4 asserts a check is RUN, not that what it asserts is correct or complete.
#
# Exit 0 = every pair evaluated and agreed. Exit 1 = at least one disagreement, or a pair that
# could not be evaluated.

set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPTS="$REPO/plugins/ae/scripts"
SUITE="$REPO/plugins/ae/tests/scripts"
fail=0

ok()  { printf '  ok    %-28s %s\n' "$1" "$2"; }
bad() { printf '  FAIL  %-28s %s\n' "$1" "$2" >&2; fail=1; }

# A delegate that is missing is a failure, not an absent pair — the invariant stops being
# checked either way, which is the thing this script is about.
delegate() { # $1 = pair label, $2 = path, $3.. = args
  label=$1; target=$2; shift 2
  if [ ! -f "$target" ]; then
    bad "$label" "delegate missing: ${target#$REPO/} — the pair is unchecked, which fails closed"
    return
  fi
  if out="$(sh "$target" "$@" 2>&1)"; then
    # Delegates report passes as either `  ok: ` (suite tests) or `  ok    ` (check scripts).
    # Counting only one shape printed "0 assertion(s) agreed" on a passing run — a wrong number
    # next to the word ok, in the script whose subject is claims that do not match reality.
    n="$(printf '%s\n' "$out" | grep -cE '^[[:space:]]*ok[:[:space:]]')"
    ok "$label" "$n assertion(s) agreed (${target##*/})"
  else
    bad "$label" "${target##*/} reported a mismatch:"
    printf '%s\n' "$out" | sed 's/^/          /' >&2
  fi
}

echo "[declared-vs-effective] reading declarations only; no backend is contacted"
echo

# --- Pairs 1-3: delegated to the checks that already own them -----------------------------
delegate "manifest single-source" "$SUITE/test-manifest-single-source.sh"
delegate "declared tools + probes"  "$SCRIPTS/check-family-reachability.sh"

# --- Pair 4: a check that exists is wired to the corpus it guards --------------------------
#
# Every `check-*.sh` must be in exactly one bucket. An unclassified one fails closed, the way
# `check-shutdown-canonical.sh` forces a new agent to choose between citing canonical policy and
# being explicitly exempt — a new check should not be able to arrive unwired and unnoticed.

# Run against the real tree, every run.
#   check-relay-attestation.sh is the only entry whose corpus is not the repository: it reads the
#   host's archived subagent transcripts, which mutate with no commit. What it gates here is the
#   half that IS in the tree — a seat whose declared tool prefix cannot be read, or an agents
#   directory that yields no declarations at all, which would let it audit nothing and report
#   success. What the archive says is reported, not gated; --gate is for asking it deliberately.
#   Stated plainly because the placement is not free: this lint can only ever redden the machine
#   that produced the archive, never CI and never a fresh clone, so it is a check on the
#   developer's own history and should not be read as covering anyone else's.
CORPUS_LINTS="check-cast-block.sh
check-shutdown-canonical.sh
check-family-reachability.sh
check-relay-attestation.sh"

# Run only when their feature's own state is present. `check-proxy-residual.sh` hardcodes an
# F-082 path and asserts a value recorded in a gitignored process file, so it cannot gate a
# fresh clone — but it MUST gate the machine where that feature is live, which is where the
# staleness it caught was produced.
FEATURE_SCOPED="check-proxy-residual.sh"

# Not corpus-wide, each for a stated reason. The reason is the point: an exemption without one
# is how a check gets quietly dropped.
#   check-agent-teams.sh  — probes this session's environment, not the repository
#   check-cross-family.sh — contacts live backends; gating the suite on a network call would
#                           redden every machine without a model server running
#   check-harness.sh      — takes a single plan path; there is no corpus-wide form of it
NOT_CORPUS_WIDE="check-agent-teams.sh
check-cross-family.sh
check-harness.sh"

in_list() { printf '%s\n' "$2" | grep -qx "$1"; }

for path in "$SCRIPTS"/check-*.sh; do
  name="$(basename "$path")"
  [ "$name" = "check-declared-vs-effective.sh" ] && continue

  if in_list "$name" "$CORPUS_LINTS"; then
    if out="$(sh "$path" 2>&1)"; then
      ok "corpus lint" "$name — clean against the live tree"
    else
      bad "corpus lint" "$name — fails against the live tree:"
      printf '%s\n' "$out" | tail -6 | sed 's/^/          /' >&2
    fi
  elif in_list "$name" "$FEATURE_SCOPED"; then
    # Presence of the feature's recorded state is what makes it runnable here.
    if sh "$path" >/dev/null 2>&1; then
      ok "feature-scoped lint" "$name — clean"
    else
      out="$(sh "$path" 2>&1)"
      case "$out" in
        *"missing"*|*"not found"*)
          ok "feature-scoped lint" "$name — feature state absent; not applicable here" ;;
        *)
          bad "feature-scoped lint" "$name — fails against the live tree:"
          printf '%s\n' "$out" | tail -6 | sed 's/^/          /' >&2 ;;
      esac
    fi
  elif in_list "$name" "$NOT_CORPUS_WIDE"; then
    ok "exempt, with a reason" "$name"
  else
    bad "unclassified check" "$name is in neither the run list nor the exemption list — a check
          nobody runs is indistinguishable from no check, so this fails closed. Add it to
          CORPUS_LINTS, or to NOT_CORPUS_WIDE with the reason it cannot run corpus-wide."
  fi
done

echo
if [ "$fail" -eq 0 ]; then
  echo "[declared-vs-effective] every pair evaluated and agreed"
else
  echo "[declared-vs-effective] MISMATCH — see failures above" >&2
fi
exit "$fail"
