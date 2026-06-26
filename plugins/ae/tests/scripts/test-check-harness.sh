#!/bin/sh
# test-check-harness.sh — F-059 Step 4 (AC5): check-harness.sh enforces the runnable-check mandate.
set -u
HERE=$(dirname "$0")
SCRIPT="$HERE/../../scripts/check-harness.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

# GOOD: deterministic AC has verify:; judge AC has none (exempt)
cat > "$tmp/good.md" <<'EOF'
## Acceptance Criteria

### AC1: det with check
- verify_by: unit
- verify: sh tests/x.sh

### AC2: judge no check (exempt)
- verify_by: judge
Rubric: looks right.

## Decisions
EOF

# BAD: deterministic AC with NO verify:
cat > "$tmp/bad.md" <<'EOF'
## Acceptance Criteria

### AC1: det WITHOUT check
- verify_by: integration
- fixture: per-feature

### AC2: judge no check (exempt)
- verify_by: judge
Rubric: looks right.

## Decisions
EOF

# JUDGE-ONLY: no deterministic ACs at all → nothing to enforce → pass
cat > "$tmp/judge.md" <<'EOF'
## Acceptance Criteria

### AC1: judge
- verify_by: judge
Rubric: q.

## Decisions
EOF

chk() { desc="$1"; exp="$2"; f="$3"; sh "$SCRIPT" "$f" >/dev/null 2>&1; got=$?
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (exit $got)"; else echo "  FAIL: $desc — expected $exp got $got" >&2; fail=1; fi; }

chk "deterministic AC WITH check -> 0" 0 "$tmp/good.md"
chk "deterministic AC WITHOUT check -> 1 (Must-fix)" 1 "$tmp/bad.md"
chk "judge-only ACs -> 0 (exempt)" 0 "$tmp/judge.md"
sh "$SCRIPT" >/dev/null 2>&1; [ $? = 2 ] && echo "  ok: bad args -> 2" || { echo "  FAIL: bad args not 2" >&2; fail=1; }

[ "$fail" = 0 ] && echo "test-check-harness.sh: PASS" || { echo "test-check-harness.sh: FAIL" >&2; exit 1; }
