#!/bin/sh
# test-collect-ac-evidence.sh — F-065 Step 1 (AC1, AC4): facts-only evidence collector.
# Mocked runner transcripts (no Rust/pytest/AE toolchain needed).
set -u
HERE=$(dirname "$0")
SCRIPT="$HERE/../../scripts/collect-ac-evidence.py"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

cat > "$tmp/cargo-real.txt" <<'EOF'
running 2 tests
test foo ... ok
test bar ... ok

test result: ok. 2 passed; 0 failed; 1 filtered out
EOF
cat > "$tmp/cargo-zero.txt" <<'EOF'
running 0 tests

test result: ok. 0 passed; 0 failed; 119 filtered out
EOF
cat > "$tmp/cargo-multi.txt" <<'EOF'
test result: ok. 2 passed; 0 failed; 0 filtered out
test result: ok. 3 passed; 0 failed; 0 filtered out
EOF
cat > "$tmp/sh-real.txt" <<'EOF'
  ok: real match -> 0 (exit 0)
  ok: zero match -> 1 (exit 1)
  FAIL: something -> broke
EOF

cat > "$tmp/plan.md" <<EOF
## Acceptance Criteria

### AC1: cargo real match
- verify_by: unit
- parser: cargo-test.v1
- verify: cat $tmp/cargo-real.txt

### AC2: cargo zero match
- verify_by: unit
- parser: cargo-test.v1
- verify: cat $tmp/cargo-zero.txt

### AC3: under min
- verify_by: unit
- parser: cargo-test.v1
- expected_match: {min_count: 3}
- verify: cat $tmp/cargo-real.txt

### AC4: unknown parser + exit 0
- verify_by: unit
- verify: cat $tmp/cargo-real.txt

### AC5: exit_code_only pass (single gate)
- verify_by: unit
- exit_code_only: true
- verify: [ 1 = 1 ]

### AC6: exit_code_only fail
- verify_by: unit
- exit_code_only: true
- verify: [ 1 = 2 ]

### AC7: judge no verify
- verify_by: judge

### AC8: sh-tap real match
- verify_by: unit
- parser: sh-tap.v1
- verify: cat $tmp/sh-real.txt

### AC9: cargo multi-target sum
- verify_by: unit
- parser: cargo-test.v1
- expected_match: {min_count: 5}
- verify: cat $tmp/cargo-multi.txt

### AC10: declared-but-unsupported parser
- verify_by: unit
- parser: madeup.v9
- verify: cat $tmp/cargo-real.txt

## Decisions
EOF

chk() { desc="$1"; exp="$2"; shift 2; python3 "$SCRIPT" "$@" >/dev/null 2>&1; got=$?
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (exit $got)"; else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

chk "cargo real match -> 0"                    0 "$tmp/plan.md" AC1
chk "cargo zero match -> 1 (integrity-failure)" 1 "$tmp/plan.md" AC2
chk "under min_count -> 1"                      1 "$tmp/plan.md" AC3
chk "unknown parser + exit 0 -> 1 (M2 policy)"  1 "$tmp/plan.md" AC4
chk "exit_code_only pass -> 0"                  0 "$tmp/plan.md" AC5
chk "exit_code_only fail -> 1"                  1 "$tmp/plan.md" AC6
chk "no verify (judge) -> 1"                    1 "$tmp/plan.md" AC7
chk "sh-tap real match -> 0"                    0 "$tmp/plan.md" AC8
chk "cargo multi-target sum (5>=5) -> 0"        0 "$tmp/plan.md" AC9
chk "declared-but-unsupported parser -> 1"      1 "$tmp/plan.md" AC10
chk "missing AC -> 1"                           1 "$tmp/plan.md" AC99
chk "bad args -> 2"                             2 "$tmp/plan.md"

# AC1 (cargo): full schema incl. wall_seconds + parser_known + expected_match sub-fields
python3 "$SCRIPT" "$tmp/plan.md" AC1 >/dev/null 2>&1
python3 -c "
import json
e=json.load(open('$tmp/milestones/evidence/AC1.json'))
assert e['verdict'] is None
assert e['matched_count']==2 and e['zero_match'] is False and len(e['matched_tests'])==2
assert e['parser']=='cargo-test.v1' and e['parser_known'] is True
assert isinstance(e['wall_seconds'], (int,float))
assert set(('min_count','names','patterns')) <= set(e['expected_match'])
print('  ok: AC1 schema — wall_seconds + parser_known + expected_match{min_count,names,patterns}')
" || { echo "  FAIL: AC1 schema" >&2; fail=1; }

# AC8 (sh-tap): matched_tests populated from ok:/FAIL: lines (3 cases)
python3 "$SCRIPT" "$tmp/plan.md" AC8 >/dev/null 2>&1
python3 -c "
import json
e=json.load(open('$tmp/milestones/evidence/AC8.json'))
assert e['matched_count']==3 and len(e['matched_tests'])==3, e['matched_count']
assert e['parser']=='sh-tap.v1' and e['parser_known'] is True
print('  ok: AC8 sh-tap — matched_count=3 from ok:/FAIL: lines')
" || { echo "  FAIL: AC8 sh-tap" >&2; fail=1; }

# AC10: declared unsupported parser -> parser_known False
python3 "$SCRIPT" "$tmp/plan.md" AC10 >/dev/null 2>&1
python3 -c "
import json
e=json.load(open('$tmp/milestones/evidence/AC10.json'))
assert e['parser']=='madeup.v9' and e['parser_known'] is False
print('  ok: AC10 parser_known=False for declared-but-unsupported')
" || { echo "  FAIL: AC10 parser_known" >&2; fail=1; }

[ "$fail" = 0 ] && echo "test-collect-ac-evidence.sh: PASS" || { echo "test-collect-ac-evidence.sh: FAIL" >&2; exit 1; }
