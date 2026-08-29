#!/bin/sh
# test-v1-foundation-freeze.sh — AE 1.0 foundation freeze corpus (F-083 / WP-P0.1).
#
# Executes the checked-in golden fixtures for the five frozen mechanisms:
# canonical bytes, the pinned validator toolchain, ae.tree-snapshot.v1, the
# acyclic installed-release bootstrap, and the policy materialization/replay
# split — plus the semantic-blindness pair.
#
# Deterministic and offline: no network, no `npm install`, no host qualification.
# The one check that needs the build toolchain (validator regeneration is
# byte-identical) reports SKIP rather than PASS when node_modules is absent.
#
# Exit: 0 = every check reproduced its expected result | 1 = at least one did not.
set -u

HERE=$(dirname "$0")
FOUNDATION="$HERE/../foundation"

if ! command -v node >/dev/null 2>&1; then
  echo "[v1-foundation] FAIL: node is required to run the foundation freeze corpus"
  exit 1
fi

exec node "$FOUNDATION/bin/verify-all.mjs" "$@"
