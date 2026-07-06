#!/bin/sh
# test-bl-id-uniqueness.sh — BL-NNN uniqueness invariant, fail-loud (F-042 AC4).
#
# The invariant-layer backstop: whatever writes a BL — the canonical allocator, a
# missed prose site, an ad-hoc origin:-direct-done-write, or a future unknown
# writer — a duplicate number fails THIS test loudly. Auto-registered by
# ae-run-tests.sh (its test-*.sh glob). Scope is identical to next-bl-id.sh's scan.
#
# Accepted limits: (i) scans .ae/backlog directly, does NOT read pipeline.yml
#   output.backlog — AE-self-dev-specific (the allocator reads config; this guard
#   hardcodes the default). (ii) uniqueness is by NUMBER with leading zeros
#   normalized, so BL-42 and BL-042 are correctly flagged as the same number.
set -u
HERE=$(dirname "$0")
ROOT=$(cd "$HERE/../../../.." && pwd)   # repo root (…/agentic-engineering)
fail=0

# Duplicate BL numbers under a base's .ae/ : backlog (recursive) ∪ feature dirs
# (one level: .ae/features/{state}/F-*/BL-*.md). Prints each duplicated number.
scan_dups() {
  base=$1
  {
    find "$base/.ae/backlog" -type f -name 'BL-*.md' 2>/dev/null
    find "$base/.ae/features/active" "$base/.ae/features/done" \
         "$base/.ae/features/abandoned" "$base/.ae/features/paused" \
         -mindepth 2 -maxdepth 2 -type f -name 'BL-*.md' 2>/dev/null
  } | sed -E 's#.*/BL-0*([0-9]+).*#\1#' | grep -E '^[0-9]+$' | sort | uniq -d
}

# 1. the live corpus must be collision-free
dups=$(scan_dups "$ROOT")
if [ -z "$dups" ]; then
  echo "  ok: no duplicate BL numbers in the live corpus"
else
  echo "  FAIL: duplicate BL number(s): $(echo "$dups" | tr '\n' ' ')" >&2
  echo "        -> two BLs share a number. Same-tree allocation is prevented by next-bl-id.sh," >&2
  echo "           so a duplicate here is almost always a MERGE of parallel worktrees/branches" >&2
  echo "           (each has its own gitignored .ae/). Renumber the newer/loser via" >&2
  echo "           \`bash plugins/ae/scripts/next-bl-id.sh\` and update its id:/title/filename." >&2
  fail=1
fi

# 2. negative self-test — the detector must FIRE on an injected duplicate.
#    Built in a mktemp tree with trap cleanup; never touches the real .ae/.
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/.ae/backlog/unscheduled" "$tmp/.ae/features/active/F-1-x"
: > "$tmp/.ae/backlog/unscheduled/BL-050-a.md"
: > "$tmp/.ae/features/active/F-1-x/BL-050.md"   # same number, feature dir = the F-042 collision shape
if [ -n "$(scan_dups "$tmp")" ]; then
  echo "  ok: detector fires on an injected duplicate (BL-050 x2)"
else
  echo "  FAIL: detector missed an injected duplicate" >&2; fail=1
fi

[ "$fail" = 0 ] && echo "test-bl-id-uniqueness.sh: PASS" || { echo "test-bl-id-uniqueness.sh: FAIL" >&2; exit 1; }
