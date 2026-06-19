#!/bin/sh
# test-discover-verifier.sh — F-047: behavioral test for discover-verifier.sh
#
# Asserts the full stdout/exit contract across all 4 conventions, precedence,
# the negative/near-miss cases, the jq-absent skip path, and the usage-error
# contract. A regression (wrong emit, wrong precedence, wrong exit) flips >=1
# case to FAIL and the script exits non-zero.
#
# Run: sh plugins/ae/tests/scripts/test-discover-verifier.sh

set -u

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS_DIR" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS_DIR/../../../.." && pwd))"
S="$REPO/plugins/ae/scripts/discover-verifier.sh"

[ -f "$S" ] || { echo "FAIL: cannot locate script under test at $S"; exit 1; }

fails=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

# assert_emit <label> <dir> <expected-stdout>
assert_emit() {
  _label="$1"; _dir="$2"; _exp="$3"
  _out="$(sh "$S" "$_dir" 2>/dev/null)"; _rc=$?
  if [ "$_rc" -eq 0 ] && [ "$_out" = "$_exp" ]; then
    pass "$_label → [$_out] exit 0"
  else
    fail "$_label → expected [$_exp] exit 0, got [$_out] exit $_rc"
  fi
}

# assert_empty <label> <dir> : empty stdout + exit 0 (none found)
assert_empty() {
  _label="$1"; _dir="$2"
  _out="$(sh "$S" "$_dir" 2>/dev/null)"; _rc=$?
  if [ "$_rc" -eq 0 ] && [ -z "$_out" ]; then
    pass "$_label → empty stdout, exit 0"
  else
    fail "$_label → expected empty stdout + exit 0, got [$_out] exit $_rc"
  fi
}

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

# --- AC1 positive cases (one per convention) ---
mkdir -p "$ROOT/c1"; printf 'test:\n\techo hi\n' > "$ROOT/c1/Makefile"
assert_emit "C1 Makefile ^test:" "$ROOT/c1" "make test"

mkdir -p "$ROOT/c2"; printf '{"scripts":{"test":"jest"}}\n' > "$ROOT/c2/package.json"
if command -v jq >/dev/null 2>&1; then
  assert_emit "C2 package.json .scripts.test" "$ROOT/c2" "npm test"
else
  echo "SKIP: C2 positive (jq not installed in this env)"
fi

mkdir -p "$ROOT/c3/tests/sub"; : > "$ROOT/c3/tests/sub/test_foo.py"
assert_emit "C3 tests/ with test_*.py (nested)" "$ROOT/c3" "pytest"
mkdir -p "$ROOT/c3b/tests"; : > "$ROOT/c3b/tests/bar_test.py"
assert_emit "C3 tests/ with *_test.py" "$ROOT/c3b" "pytest"

mkdir -p "$ROOT/c4"; : > "$ROOT/c4/foo.test.sh"
assert_emit "C4 top-level foo.test.sh → basename only" "$ROOT/c4" "sh foo.test.sh"

# bare test.sh as the sole C4 match (both *.test.sh AND test.sh are in scope)
mkdir -p "$ROOT/c4bare"; : > "$ROOT/c4bare/test.sh"
assert_emit "C4 bare test.sh alone" "$ROOT/c4bare" "sh test.sh"

# C3 with a symlinked tests/ dir → find -L must descend and still emit pytest
mkdir -p "$ROOT/c3sym/realtests"; : > "$ROOT/c3sym/realtests/test_foo.py"
ln -s realtests "$ROOT/c3sym/tests"
assert_emit "C3 symlinked tests/ dir → pytest" "$ROOT/c3sym" "pytest"

# Makefile with a blank before the colon (POSIX make allows `test :`)
mkdir -p "$ROOT/c1sp"; printf 'test :\n\techo hi\n' > "$ROOT/c1sp/Makefile"
assert_emit "C1 Makefile 'test :' (blank before colon)" "$ROOT/c1sp" "make test"

# --- AC1 precedence: C1 wins over C2 ---
mkdir -p "$ROOT/prec"
printf 'test:\n\techo\n' > "$ROOT/prec/Makefile"
printf '{"scripts":{"test":"jest"}}\n' > "$ROOT/prec/package.json"
assert_emit "precedence C1>C2 (Makefile + package.json)" "$ROOT/prec" "make test"

# C4 within-convention precedence: lexicographic first wins (a.test.sh < test.sh)
mkdir -p "$ROOT/c4p"; : > "$ROOT/c4p/test.sh"; : > "$ROOT/c4p/a.test.sh"
assert_emit "C4 lexicographic first (a.test.sh before test.sh)" "$ROOT/c4p" "sh a.test.sh"

# --- AC2 negative / near-miss cases (empty stdout, exit 0) ---
mkdir -p "$ROOT/empty"
assert_empty "empty dir" "$ROOT/empty"

mkdir -p "$ROOT/n_tests/tests"; : > "$ROOT/n_tests/tests/readme.txt"
assert_empty "tests/ without test_*.py" "$ROOT/n_tests"

mkdir -p "$ROOT/n_pjempty"; printf '{"scripts":{"test":""}}\n' > "$ROOT/n_pjempty/package.json"
assert_empty "package.json empty-string .scripts.test" "$ROOT/n_pjempty"

mkdir -p "$ROOT/n_pjnokey"; printf '{"scripts":{"build":"x"}}\n' > "$ROOT/n_pjnokey/package.json"
assert_empty "package.json without scripts.test key" "$ROOT/n_pjnokey"

mkdir -p "$ROOT/n_mk"; printf 'build:\n\techo\n' > "$ROOT/n_mk/Makefile"
assert_empty "Makefile without ^test: target" "$ROOT/n_mk"

# --- jq-absent skip path (Convention 2 must skip, NOT fall back to a false-match) ---
# Build a jq-free PATH by symlinking only the coreutils the script needs into a clean
# bin dir (jq deliberately excluded), then run the script with that PATH. This proves
# the command -v jq guard skips Convention 2 when jq is unavailable.
JQFREE="$ROOT/.jqfree-bin"
mkdir -p "$JQFREE"
REAL_SH="$(command -v sh)"
for b in grep find sort head sed cat; do
  p="$(command -v "$b" 2>/dev/null)" && ln -sf "$p" "$JQFREE/$b"
done
mkdir -p "$ROOT/jqabsent"; printf '{"scripts":{"test":"jest"}}\n' > "$ROOT/jqabsent/package.json"
out="$(PATH="$JQFREE" "$REAL_SH" "$S" "$ROOT/jqabsent" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  pass "jq-absent → Convention 2 skipped, empty stdout, exit 0 (no false-match)"
else
  fail "jq-absent → expected empty stdout + exit 0, got [$out] exit $rc"
fi

# --- AC2 usage-error contract: missing arg, non-dir arg (stderr + exit 2, empty stdout) ---
out="$(sh "$S" 2>/dev/null)"; rc=$?
err="$(sh "$S" 2>&1 1>/dev/null)"
if [ "$rc" -eq 2 ] && [ -z "$out" ] && [ -n "$err" ]; then
  pass "missing arg → exit 2, empty stdout, non-empty stderr"
else
  fail "missing arg → expected exit 2 + empty stdout + stderr, got rc=$rc out=[$out] err=[$err]"
fi

out="$(sh "$S" "$ROOT/does-not-exist" 2>/dev/null)"; rc=$?
err="$(sh "$S" "$ROOT/does-not-exist" 2>&1 1>/dev/null)"
if [ "$rc" -eq 2 ] && [ -z "$out" ] && [ -n "$err" ]; then
  pass "non-directory arg → exit 2, empty stdout, non-empty stderr"
else
  fail "non-directory arg → expected exit 2 + empty stdout + stderr, got rc=$rc out=[$out] err=[$err]"
fi

# --- dash-leading dir name resolves as a path, not a grep/find option ---
mkdir -p "$ROOT/-dashdir"; printf 'test:\n\techo\n' > "$ROOT/-dashdir/Makefile"
out="$( cd "$ROOT" && sh "$S" -dashdir 2>/dev/null )"; rc=$?
if [ "$rc" -eq 0 ] && [ "$out" = "make test" ]; then
  pass "dash-leading dir (-dashdir) resolved as path → make test"
else
  fail "dash-leading dir → expected [make test] exit 0, got [$out] exit $rc"
fi

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$fails FAILURE(S)"
  exit 1
fi
