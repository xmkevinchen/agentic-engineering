#!/bin/sh
# test-loop-decide.sh — F-048 Step 1 contract tests for loop-decide + parse-review-verdict.
# Pure deterministic unit tests (no LLM). Run: sh plugins/ae/tests/scripts/test-loop-decide.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPTS="$HERE/../../scripts"
DECIDE="$SCRIPTS/loop-decide.sh"
PARSE="$SCRIPTS/parse-review-verdict.sh"
fail=0

# assert <desc> <expected-stdout> <expected-exit> -- cmd...
assert() {
  desc=$1; exp_out=$2; exp_code=$3; shift 3
  out=$("$@" 2>/dev/null); code=$?
  if [ "$out" = "$exp_out" ] && [ "$code" -eq "$exp_code" ]; then
    echo "ok: $desc"
  else
    echo "FAIL: $desc — got out=[$out] code=$code, want out=[$exp_out] code=$exp_code"
    fail=1
  fi
}

# --- loop-decide: dispatch / halt / cap (AC1, AC2) ---
assert "dispatch iter0"        dispatch_fixup 0 sh "$DECIDE" fail 0 3
assert "dispatch iter2 (cap-1)" dispatch_fixup 0 sh "$DECIDE" fail 2 3
assert "halt on pass"          exit_pass      0 sh "$DECIDE" pass 1 3
assert "escalate at cap"       escalate_cap   0 sh "$DECIDE" fail 3 3
assert "escalate past cap"     escalate_cap   0 sh "$DECIDE" fail 4 3

# --- loop-decide: invalid verdict counts as fail (AC3) ---
assert "invalid->dispatch"     dispatch_fixup 0 sh "$DECIDE" invalid 0 3
assert "invalid->escalate"     escalate_cap   0 sh "$DECIDE" invalid 3 3

# --- loop-decide: invalid input -> non-zero, empty stdout (AC3) ---
assert "bad argc"              "" 2 sh "$DECIDE" fail 1
assert "non-int iter"          "" 2 sh "$DECIDE" fail x 3
assert "negative iter"         "" 2 sh "$DECIDE" fail -1 3
assert "zero cap"              "" 2 sh "$DECIDE" fail 0 0
assert "unknown verdict"       "" 2 sh "$DECIDE" maybe 0 3

# --- parse-review-verdict: normalize to pass|fail|invalid ---
tmp=$(mktemp -d)
# Fixtures use real review-file shape: verdict lives in the LEADING --- frontmatter block
# (parse-review-verdict counts/extracts only there — codex P2-5).
printf -- '---\nverdict: pass\n---\n'                 > "$tmp/pass.md"
printf -- '---\nverdict: fail\n---\n'                 > "$tmp/fail.md"
printf -- '---\ntitle: x\nstatus: done\n---\n'        > "$tmp/none.md"
printf -- '---\nverdict: needs_work\n---\n'           > "$tmp/unk.md"
printf -- '---\nverdict: pass\nverdict: fail\n---\n'  > "$tmp/dup.md"
printf -- '---\nverdict: "pass"\n---\n'               > "$tmp/quoted.md"
# codex P2-5 lock: a 'verdict:' line in the BODY must NOT flip a passing review to invalid.
printf -- '---\nverdict: pass\n---\n# Review\ndiscussing the verdict: field schema\n' > "$tmp/body.md"
printf -- '---\nverdict: pass\n'                       > "$tmp/unclosed.md"   # codex P1: no closing fence
assert "parse pass"            pass    0 sh "$PARSE" "$tmp/pass.md"
assert "parse fail"            fail    0 sh "$PARSE" "$tmp/fail.md"
assert "parse missing->invalid" invalid 0 sh "$PARSE" "$tmp/none.md"
assert "parse unknown->invalid" invalid 0 sh "$PARSE" "$tmp/unk.md"
assert "parse dup->invalid"    invalid 0 sh "$PARSE" "$tmp/dup.md"
assert "parse quoted pass"     pass    0 sh "$PARSE" "$tmp/quoted.md"
assert "parse body-verdict ignored" pass 0 sh "$PARSE" "$tmp/body.md"
assert "parse unclosed-fm->invalid" invalid 0 sh "$PARSE" "$tmp/unclosed.md"
assert "parse not-a-file"      "" 2 sh "$PARSE" "$tmp/nope.md"
rm -rf "$tmp"

# --- loop-decide: invalid verdict emits a DISTINCT stderr diagnostic (MF-4, not silent) ---
err=$(sh "$DECIDE" invalid 0 3 2>&1 >/dev/null)
case $err in
  *"invalid verdict treated as fail"*) echo "ok: invalid emits stderr diagnostic" ;;
  *) echo "FAIL: invalid stderr diagnostic missing — got [$err]"; fail=1 ;;
esac

if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; exit 1; fi
