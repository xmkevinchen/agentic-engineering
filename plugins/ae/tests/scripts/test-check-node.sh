#!/bin/sh
# test-check-node.sh — F-050 AC1: check-node.sh re-derives a node verdict from disk.
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
CHECK="$ROOT/plugins/ae/scripts/check-node.sh"
[ -f "$CHECK" ] || { echo "FAIL: check-node.sh not found at $CHECK" >&2; exit 1; }

SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
cd "$SB"

cat > plan.md <<'EOF'
# Feature: fixture

## Steps

### Step 1: auto deterministic node (AC1)
- [ ] do the thing
Expected files: out/made.txt, out/also.txt

### Step 2: judged node (AC2)
- [ ] judge the thing
Expected files: out/judged.txt

## Acceptance Criteria

### AC1: Reference Case
- verify_by: integration
- human-gate: false

### AC2: Output Verification
- verify_by: judge
- human-gate: true
EOF

mkdir -p out
fail=0
assert() { # <label> <expected-exit> <actual-exit>
  if [ "$2" = "$3" ]; then echo "  ok: $1 (exit $3)"; else echo "  FAIL: $1 — expected exit $2, got $3" >&2; fail=1; fi
}

# (a) auto node, deliverables MISSING → fail (1)
set +e; sh "$CHECK" plan.md 1 >/dev/null 2>&1; rc=$?; set -e
assert "auto node, missing deliverables → fail" 1 "$rc"

# (b) auto node, deliverables PRESENT → pass (0)
: > out/made.txt; : > out/also.txt
set +e; sh "$CHECK" plan.md 1 >/dev/null 2>&1; rc=$?; set -e
assert "auto node, all deliverables present → pass" 0 "$rc"

# (c) mutation: remove one deliverable → fail (1)
rm -f out/also.txt
set +e; sh "$CHECK" plan.md 1 >/dev/null 2>&1; rc=$?; set -e
assert "mutation: deliverable removed → fail" 1 "$rc"
: > out/also.txt  # restore

# (d) judge/manual node → gate (2), regardless of deliverables
: > out/judged.txt
set +e; sh "$CHECK" plan.md 2 >/dev/null 2>&1; rc=$?; set -e
assert "judge node → gate" 2 "$rc"

# (e) auto node + fixup cap exhausted (iter>=cap) → gate (2) escalate
set +e; sh "$CHECK" plan.md 1 3 3 >/dev/null 2>&1; rc=$?; set -e
assert "auto node, cap exhausted (iter 3 >= cap 3) → gate" 2 "$rc"

# (f) auto node, iter < cap, deliverables present → pass (0)
set +e; sh "$CHECK" plan.md 1 1 3 >/dev/null 2>&1; rc=$?; set -e
assert "auto node, iter 1 < cap 3, present → pass" 0 "$rc"
[ "$fail" = 0 ] && echo "ok test-check-node" || { echo "test-check-node FAILED" >&2; exit 1; }
