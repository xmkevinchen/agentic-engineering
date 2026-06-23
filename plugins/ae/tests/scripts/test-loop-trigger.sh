#!/bin/sh
# test-loop-trigger.sh — F-050 AC3: disk-derived loop-engagement trigger.
# The trigger fires from a plan-time annotation (human-gate:false) on disk, NOT from
# runtime verify_by-presence (which was forgeable by omission — the Pong LOOP_ITER-never-fired bug).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
CHECK="$ROOT/plugins/ae/scripts/check-node.sh"
[ -f "$CHECK" ] || { echo "FAIL: check-node.sh not found" >&2; exit 1; }

SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert() { if [ "$2" = "$3" ]; then echo "  ok: $1 (exit $3)"; else echo "  FAIL: $1 — expected $2 got $3" >&2; fail=1; fi; }

# (a) plan with >=1 auto-node (human-gate: false) → engage (exit 0)
cat > auto.md <<'EOF'
### Step 1: deterministic (AC1)
Expected files: x.txt
### AC1: Reference Case
- verify_by: integration
- human-gate: false
EOF
set +e; sh "$CHECK" auto.md trigger >/dev/null 2>&1; rc=$?; set -e
assert "plan with human-gate:false → engage" 0 "$rc"

# (b) plan with NO auto-node (all human-gate: true) → legacy (exit 1)
cat > allgate.md <<'EOF'
### Step 1: judged (AC1)
Expected files: x.txt
### AC1: Output Verification
- verify_by: judge
- human-gate: true
EOF
set +e; sh "$CHECK" allgate.md trigger >/dev/null 2>&1; rc=$?; set -e
assert "plan with only human-gate:true → legacy (no loop)" 1 "$rc"

# (c) legacy plan (no human-gate annotation at all) → legacy (exit 1) — backward-compatible
cat > legacy.md <<'EOF'
### Step 1: old-style (AC1)
Expected files: x.txt
### AC1: Reference Case
- verify_by: integration
EOF
set +e; sh "$CHECK" legacy.md trigger >/dev/null 2>&1; rc=$?; set -e
assert "legacy plan (no human-gate) → legacy (backward-compat)" 1 "$rc"

# (d) mutation: add a human-gate:false to the legacy plan → now engages
printf '\n- human-gate: false\n' >> legacy.md
set +e; sh "$CHECK" legacy.md trigger >/dev/null 2>&1; rc=$?; set -e
assert "mutation: add human-gate:false → engage" 0 "$rc"

[ "$fail" = 0 ] && echo "ok test-loop-trigger" || { echo "test-loop-trigger FAILED" >&2; exit 1; }
