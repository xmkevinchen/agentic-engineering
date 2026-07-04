#!/bin/sh
# test-check-shutdown-canonical.sh — F-046: mutation/negative test for check-shutdown-canonical.sh
#
# Closes the false-green gap: the existing L1 fixtures only prove the script exits 0
# on a clean repo. They never prove it exits 1 when a "type": "shutdown_response"
# sentinel is actually present — so a logic regression (broken grep, silent loop
# failure) would pass CI green. This test injects the sentinel and asserts exit 1.
#
# The script under test hardcodes its scan paths (REPO_ROOT = git toplevel || pwd;
# AGENTS_DIR = $REPO_ROOT/plugins/ae/agents; CANONICAL_DOC = .../agent-teams/SKILL.md)
# and takes NO directory argument. So we build a fake repo root that satisfies those
# paths, copy the real script in, and run it from there — with no .git present the
# script's `pwd` fallback makes REPO_ROOT = our fake root.
#
# Run: sh plugins/ae/tests/scripts/test-check-shutdown-canonical.sh

set -u

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS_DIR" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS_DIR/../../../.." && pwd))"
REAL_SCRIPT="$REPO/plugins/ae/scripts/check-shutdown-canonical.sh"

[ -f "$REAL_SCRIPT" ] || { echo "FAIL: cannot locate script under test at $REAL_SCRIPT"; exit 1; }

fails=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

# Build a fake repo root satisfying the script's hardcoded paths.
build_root() {
  root="$1"
  # git init so the script-under-test's `git rev-parse --show-toplevel` resolves to
  # THIS fake root, not a parent repo — guards against TMPDIR living inside a git
  # checkout. Without it the test would be env-dependent.
  git -C "$root" init -q
  mkdir -p "$root/plugins/ae/scripts" \
           "$root/plugins/ae/skills/agent-teams" \
           "$root/plugins/ae/agents/workflow"
  cp "$REAL_SCRIPT" "$root/plugins/ae/scripts/check-shutdown-canonical.sh"
  # Canonical doc must contain the section header the script greps for (line 36).
  printf '## Shutdown handshake (canonical)\n' \
    > "$root/plugins/ae/skills/agent-teams/SKILL.md"
}

# --- AC1 negative case: forbidden sentinel present → script must exit non-zero ---
# The fixture ALSO carries the canonical reference (see also
# challenger conf-8). Without the reference, a regressed sentinel-grep would still
# exit 1 via the missing-reference branch and the test would pass — its own
# false-green. With the reference present, the ONLY way to exit 1 is the sentinel
# branch firing, so this case genuinely isolates sentinel detection.
NEG="$(mktemp -d)"
build_root "$NEG"
printf 'agent body line\nSee ae:agent-teams § Shutdown handshake (canonical) for the protocol.\n"type": "shutdown_response"\n' \
  > "$NEG/plugins/ae/agents/workflow/bad.md"
( cd "$NEG" && sh plugins/ae/scripts/check-shutdown-canonical.sh ) >/dev/null 2>&1
rc=$?
if [ "$rc" -ne 0 ]; then
  pass "negative: sentinel injected (with canonical ref present) → exit $rc (sentinel branch isolated)"
else
  fail "negative: injected sentinel but exit 0 — FALSE-GREEN, sentinel detection broken"
fi
rm -rf "$NEG"

# --- AC2 positive case: clean agent carrying the canonical reference → exit 0 ---
POS="$(mktemp -d)"
build_root "$POS"
printf 'agent body line\nSee ae:agent-teams § Shutdown handshake (canonical) for the protocol.\n' \
  > "$POS/plugins/ae/agents/workflow/good.md"
out="$( cd "$POS" && sh plugins/ae/scripts/check-shutdown-canonical.sh 2>&1 )"
rc=$?
# Assert the exact counters (scanned=1 referenced=1 failures=0), not just failures=0
# — a regression that skips the scan loop entirely would still print failures=0 and
# exit 0. Pinning scanned=1 proves the file was visited.
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'scanned=1 referenced=1 exempt=0 failures=0'; then
  pass "positive: clean + referenced → exit 0, scanned=1 referenced=1 failures=0"
else
  fail "positive: expected exit 0 + scanned=1 referenced=1 exempt=0 failures=0, got exit $rc (out: $out)"
fi
rm -rf "$POS"

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$fails FAILURE(S)"
  exit 1
fi
