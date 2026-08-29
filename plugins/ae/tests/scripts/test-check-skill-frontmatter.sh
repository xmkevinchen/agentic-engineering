#!/bin/sh
# test-check-skill-frontmatter.sh — the frontmatter check behaves, not just "string present".
# Run against a known-FAILING fixture -> non-zero; a passing fixture -> zero.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
CHECK="$HERE/../../scripts/check-skill-frontmatter.sh"
fail=0
tmp=$(mktemp -d)

# passing fixture: a well-formed SKILL.md whose name is the bare directory segment
mkdir -p "$tmp/good/ok"
printf -- '---\nname: ok\ndescription: x\n---\n# ok\n' > "$tmp/good/ok/SKILL.md"
sh "$CHECK" "$tmp/good" >/dev/null 2>&1
[ $? -eq 0 ] && echo "ok: passing fixture -> exit 0" || { echo "FAIL: passing fixture should exit 0"; fail=1; }

# failing fixture: SKILL.md missing the `name` frontmatter
mkdir -p "$tmp/bad/broken"
printf -- '---\ndescription: no name field\n---\n# broken\n' > "$tmp/bad/broken/SKILL.md"
sh "$CHECK" "$tmp/bad" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: failing fixture -> non-zero" || { echo "FAIL: failing fixture should exit non-zero"; fail=1; }

# empty dir that EXISTS but has no SKILL.md -> "no SKILL.md found" exit 2 (was
# testing a MISSING dir, never exercising this branch).
mkdir -p "$tmp/empty"
sh "$CHECK" "$tmp/empty" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: empty dir (no SKILL.md) -> non-zero" || { echo "FAIL: empty dir should exit non-zero"; fail=1; }

# malformed leading frontmatter: name present + '---' present but NOT a valid leading block
# (anywhere-match used to false-green this).
mkdir -p "$tmp/malformed/x"
printf -- 'No frontmatter.\nname: x\nbody --- one\nbody --- two\n' > "$tmp/malformed/x/SKILL.md"
sh "$CHECK" "$tmp/malformed" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: malformed leading block -> non-zero" || { echo "FAIL: malformed leading block should fail"; fail=1; }

# --- CC 2.1.216 regression: the prefix must not come back ---------------------
# Claude Code prepends the plugin namespace itself, so a `name: ae:<skill>`
# value renders as `/ae:ae:<skill>`. Both fixtures below carry the prefix on
# purpose: the pre-2.1.216 oracle REQUIRED it (`grep -q '^name: ae:'`), so
# these are precisely the shapes it accepted and the current one must reject.
# An unprefixed mismatch would have failed the old rule too, and so would say
# nothing about the blind spot that was closed.

# (a) prefixed name matching its directory — the exact value all 24 skills carried
mkdir -p "$tmp/prefixed/foo"
printf -- '---\nname: ae:foo\ndescription: x\n---\n# foo\n' > "$tmp/prefixed/foo/SKILL.md"
sh "$CHECK" "$tmp/prefixed" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: prefixed name -> non-zero" || { echo "FAIL: 'name: ae:foo' should exit non-zero"; fail=1; }

# (b) prefixed AND mismatched against its directory
mkdir -p "$tmp/mismatch/foo"
printf -- '---\nname: ae:bar\ndescription: x\n---\n# foo\n' > "$tmp/mismatch/foo/SKILL.md"
sh "$CHECK" "$tmp/mismatch" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: name not matching its directory -> non-zero" || { echo "FAIL: 'name: ae:bar' in dir 'foo' should exit non-zero"; fail=1; }

# (c) duplicate `name:` keys — the shell window and the host's YAML parser would
# disagree about which value is live, so a first-match check could green a file
# the host resolves differently.
mkdir -p "$tmp/dup/foo"
printf -- '---\nname: foo\nname: ae:foo\ndescription: x\n---\n# foo\n' > "$tmp/dup/foo/SKILL.md"
sh "$CHECK" "$tmp/dup" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: duplicate name keys -> non-zero" || { echo "FAIL: duplicate 'name:' keys should exit non-zero"; fail=1; }

# (d) the underscore spelling of user-invocable: silently ignored by the host,
# and for this key that decides whether the command appears at all.
mkdir -p "$tmp/underscore/foo"
printf -- '---\nname: foo\nuser_invocable: true\n---\n# foo\n' > "$tmp/underscore/foo/SKILL.md"
sh "$CHECK" "$tmp/underscore" >/dev/null 2>&1
[ $? -ne 0 ] && echo "ok: user_invocable underscore -> non-zero" || { echo "FAIL: 'user_invocable' should exit non-zero"; fail=1; }

rm -rf "$tmp"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
