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

# empty dir -> usage error (exit 2), not a false pass
sh "$L1" "$tmp/empty" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: missing dir -> non-zero" || { echo "FAIL: missing dir should exit non-zero"; fail=1; }

rm -rf "$tmp"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
