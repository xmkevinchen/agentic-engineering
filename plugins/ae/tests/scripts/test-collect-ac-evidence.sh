#!/bin/sh
# test-collect-ac-evidence.sh — F-065 Step 1 (AC1, AC4): facts-only evidence collector.
# Mocked runner transcripts (no Rust/pytest toolchain needed).
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

cat > "$tmp/plan.md" <<EOF
## Acceptance Criteria

### AC1: real match
- verify_by: unit
- parser: cargo-test.v1
- verify: cat $tmp/cargo-real.txt

### AC2: zero match
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

### AC5: exit_code_only pass
- verify_by: unit
- exit_code_only: true
- verify: [ 1 = 1 ]

### AC6: exit_code_only fail
- verify_by: unit
- exit_code_only: true
- verify: [ 1 = 2 ]

### AC7: judge no verify
- verify_by: judge

## Decisions
EOF

chk() { desc="$1"; exp="$2"; shift 2; python3 "$SCRIPT" "$@" >/dev/null 2>&1; got=$?
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (exit $got)"; else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

chk "real match -> 0"                          0 "$tmp/plan.md" AC1
chk "zero match -> 1 (integrity-failure)"      1 "$tmp/plan.md" AC2
chk "under min_count -> 1"                     1 "$tmp/plan.md" AC3
chk "unknown parser + exit 0 -> 1 (M2 policy)" 1 "$tmp/plan.md" AC4
chk "exit_code_only pass -> 0"                 0 "$tmp/plan.md" AC5
chk "exit_code_only fail -> 1"                 1 "$tmp/plan.md" AC6
chk "no verify (judge) -> 1"                   1 "$tmp/plan.md" AC7
chk "missing AC -> 1"                          1 "$tmp/plan.md" AC9
chk "bad args -> 2"                            2 "$tmp/plan.md"

# AC1 evidence: full schema + verdict:null + facts
python3 "$SCRIPT" "$tmp/plan.md" AC1 >/dev/null 2>&1
EV="$tmp/milestones/evidence/AC1.json"
if [ -f "$EV" ]; then
  python3 -c "
import json
e=json.load(open('$EV'))
assert e['verdict'] is None, 'verdict must be null'
assert e['zero_match'] is False and e['matched_count']==2, 'matched_count/zero_match'
assert len(e['matched_tests'])==2, 'matched_tests'
assert e['parser']=='cargo-test.v1' and e['parser_known'] is True, 'parser'
for k in ('ac_id','command','exit_code','cwd','started_at','expected_match','raw_output_path'): e[k]
print('  ok: AC1 evidence schema + verdict:null + matched_count=2')
" || { echo "  FAIL: AC1 evidence schema" >&2; fail=1; }
else echo "  FAIL: AC1 evidence file not written" >&2; fail=1; fi

[ "$fail" = 0 ] && echo "test-collect-ac-evidence.sh: PASS" || { echo "test-collect-ac-evidence.sh: FAIL" >&2; exit 1; }
