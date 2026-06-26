#!/bin/sh
# test-verify-ac.sh — F-059 Step 2 (AC2): verify-ac.py runs an AC's verify: + rejects forgery.
set -u
HERE=$(dirname "$0")
SCRIPT="$HERE/../../scripts/verify-ac.py"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

cat > "$tmp/plan.md" <<'EOF'
## Acceptance Criteria

### AC1: pass case
- verify_by: unit
- verify: [ 1 = 1 ]

### AC2: fail case
- verify_by: unit
- verify: false

### AC3: forgeable dot
- verify_by: unit
- verify: .

### AC4: forgeable star
- verify_by: unit
- verify: *

### AC5: forgeable true
- verify_by: unit
- verify: true

### AC6: empty value
- verify_by: unit
- verify:

### AC7: judge, no check
- verify_by: judge
Rubric: something.

## Decisions
EOF

chk() { # desc expected-exit args...
  desc="$1"; exp="$2"; shift 2
  python3 "$SCRIPT" "$@" >/dev/null 2>&1; got=$?
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (exit $got)"; else echo "  FAIL: $desc — expected $exp got $got" >&2; fail=1; fi
}

chk "passing verify: -> 0"        0 "$tmp/plan.md" AC1
chk "failing verify: -> 1"        1 "$tmp/plan.md" AC2
chk "forgeable . -> 1"            1 "$tmp/plan.md" AC3
chk "forgeable * -> 1"            1 "$tmp/plan.md" AC4
chk "forgeable true -> 1"         1 "$tmp/plan.md" AC5
chk "empty verify: value -> 1"    1 "$tmp/plan.md" AC6
chk "no verify: line (judge) -> 1" 1 "$tmp/plan.md" AC7
chk "missing AC -> 1"             1 "$tmp/plan.md" AC9
chk "bad args -> 2"               2 "$tmp/plan.md"
chk "AC-id without prefix -> 0"   0 "$tmp/plan.md" 1

[ "$fail" = 0 ] && echo "test-verify-ac.sh: PASS" || { echo "test-verify-ac.sh: FAIL" >&2; exit 1; }
