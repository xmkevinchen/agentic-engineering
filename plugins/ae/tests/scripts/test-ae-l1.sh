#!/bin/sh
# test-ae-l1.sh — F-048 Step 5 / AC6b: the L1 oracle behaves (not just "string present").
# Run against a known-FAILING fixture -> non-zero; a passing fixture -> zero.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
L1="$HERE/../../scripts/ae-test-plugin-regression-layer1.sh"
fail=0
tmp=$(mktemp -d)

# passing fixture: a well-formed SKILL.md
mkdir -p "$tmp/good/ok"
printf -- '---\nname: ae:ok\ndescription: x\n---\n# ok\n' > "$tmp/good/ok/SKILL.md"
sh "$L1" "$tmp/good" >/dev/null 2>&1
[ $? -eq 0 ] && echo "ok: passing fixture -> exit 0" || { echo "FAIL: passing fixture should exit 0"; fail=1; }

# failing fixture: SKILL.md missing the `name: ae:` frontmatter
mkdir -p "$tmp/bad/broken"
printf -- '---\ndescription: no name field\n---\n# broken\n' > "$tmp/bad/broken/SKILL.md"
sh "$L1" "$tmp/bad" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: failing fixture -> non-zero" || { echo "FAIL: failing fixture should exit non-zero"; fail=1; }

# empty dir that EXISTS but has no SKILL.md -> "no SKILL.md found" exit 2 (was
# testing a MISSING dir, never exercising this branch).
mkdir -p "$tmp/empty"
sh "$L1" "$tmp/empty" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: empty dir (no SKILL.md) -> non-zero" || { echo "FAIL: empty dir should exit non-zero"; fail=1; }

# malformed leading frontmatter: name:ae: + '---' present but NOT a valid leading block
# (anywhere-match used to false-green this).
mkdir -p "$tmp/malformed/x"
printf -- 'No frontmatter.\nname: ae:x\nbody --- one\nbody --- two\n' > "$tmp/malformed/x/SKILL.md"
sh "$L1" "$tmp/malformed" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: malformed leading block -> non-zero" || { echo "FAIL: malformed leading block should fail"; fail=1; }

rm -rf "$tmp"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
