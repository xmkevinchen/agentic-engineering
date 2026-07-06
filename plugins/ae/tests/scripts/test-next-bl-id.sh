#!/bin/sh
# test-next-bl-id.sh — the canonical BL allocator (F-042 AC2).
# Fixture-based: builds throwaway .ae/ trees in mktemp dirs; never touches the real tree.
set -u
HERE=$(dirname "$0")
SCRIPT=$(cd "$HERE/../../scripts" && pwd)/next-bl-id.sh
fail=0
chk() { desc="$1"; exp="$2"; got="$3"
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (-> $got)"
  else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

# 1. union max across backlog {001,005} + feature {010} -> 011
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/.ae/backlog/unscheduled" "$tmp/.ae/features/active/F-9-x"
: > "$tmp/.ae/backlog/unscheduled/BL-001-a.md"
: > "$tmp/.ae/backlog/unscheduled/BL-005-b.md"
: > "$tmp/.ae/features/active/F-9-x/BL-010.md"
chk "backlog∪feature max 010 -> 011" "011" "$(cd "$tmp" && sh "$SCRIPT")"

# 2. zero-pad: BL-009 present -> 010 (not 10)
t=$(mktemp -d); mkdir -p "$t/.ae/backlog"; : > "$t/.ae/backlog/BL-009-x.md"
chk "zero-pad 009 -> 010" "010" "$(cd "$t" && sh "$SCRIPT")"; rm -rf "$t"

# 3. empty state -> 001
t=$(mktemp -d); mkdir -p "$t/.ae/backlog"
chk "empty -> 001" "001" "$(cd "$t" && sh "$SCRIPT")"; rm -rf "$t"

# 4. promote-invisibility: a feature-resident BL higher than the backlog max must
#    still be counted (the F-042 bug: backlog-only scan would return 004, colliding)
t=$(mktemp -d); mkdir -p "$t/.ae/backlog" "$t/.ae/features/done/F-1-y"
: > "$t/.ae/backlog/BL-003-a.md"; : > "$t/.ae/features/done/F-1-y/BL-020.md"
chk "feature 020 > backlog 003 -> 021 (promote-invisibility)" "021" "$(cd "$t" && sh "$SCRIPT")"; rm -rf "$t"

[ "$fail" = 0 ] && echo "test-next-bl-id.sh: PASS" || { echo "test-next-bl-id.sh: FAIL" >&2; exit 1; }
