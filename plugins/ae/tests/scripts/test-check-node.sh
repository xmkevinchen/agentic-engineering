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

# --- F-051 AC4: node_check content gate + backward-compat ---
cat > plan2.md <<'EOF'
# Feature: node_check fixture

## Steps

### Step 1: auto node with passing node_check (AC1)
- [ ] make the file
Expected files: gen/routes.txt
node_check: file-contains target=gen/routes.txt pattern=billing

### Step 2: auto node with failing node_check (AC2)
- [ ] make the file
Expected files: gen/routes.txt
node_check: file-contains target=gen/routes.txt pattern=absent-token

### Step 3: auto node with invalid node_check params (AC3)
- [ ] make the file
Expected files: gen/routes.txt
node_check: file-contains target=gen/routes.txt

### Step 4: auto node, no node_check (backward-compat) (AC4)
- [ ] make the file
Expected files: gen/routes.txt

## Acceptance Criteria

### AC1: Reference
- verify_by: integration
- human-gate: false

### AC2: Reference
- verify_by: integration
- human-gate: false

### AC3: Reference
- verify_by: integration
- human-gate: false

### AC4: Reference
- verify_by: integration
- human-gate: false
EOF
mkdir -p gen; printf 'route billing here\n' > gen/routes.txt

# (g) node_check present + deliverable present + pattern matches → pass
set +e; sh "$CHECK" plan2.md 1 >/dev/null 2>&1; rc=$?; set -e
assert "node_check passing → pass" 0 "$rc"

# (h) node_check pattern absent → fail (content gate bites even though file present)
set +e; sh "$CHECK" plan2.md 2 >/dev/null 2>&1; rc=$?; set -e
assert "node_check failing pattern → fail" 1 "$rc"

# (i) node_check invalid (missing required param) → fail, does NOT advance
set +e; sh "$CHECK" plan2.md 3 >/dev/null 2>&1; rc=$?; set -e
assert "node_check invalid params → fail" 1 "$rc"

# (j) no node_check → today's behavior (presence-only) → pass
set +e; sh "$CHECK" plan2.md 4 >/dev/null 2>&1; rc=$?; set -e
assert "no node_check (backward-compat) → pass" 0 "$rc"

# (k) node_check step but deliverable MISSING → fail at presence (node_check not reached)
rm -f gen/routes.txt
set +e; sh "$CHECK" plan2.md 1 >/dev/null 2>&1; rc=$?; set -e
assert "node_check step, deliverable missing → fail (presence)" 1 "$rc"

[ "$fail" = 0 ] && echo "ok test-check-node" || { echo "test-check-node FAILED" >&2; exit 1; }
