#!/bin/sh
# Repo-entering text carries no review bookkeeping: reviewer-attribution
# wrappers in shipped surfaces (scripts, tests, skills, agents, docs) fail
# this gate. Functional cross-family references (proxy agents, family
# selection, MCP names) are exempt by pattern; whole-file exemptions are
# enumerated. New violations fail the suite instead of waiting for the next
# manual audit.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# attribution shapes: "(codex ...)", "(gemini ...)", "(doodlestein ...)",
# "codex P1"-style severity tags, "review iter-N" cycle bookkeeping
PATTERN='\((codex|gemini)[^)]*\)|\(doodlestein[ -][^)]+\)|(codex|gemini|architect|challenger|security) (P|C|F)[0-9]|codex[0-9]* iter|review (iter-?[0-9]|finding:)'

# functional-line exemptions: the cross-family FEATURE legitimately names families
FUNC='proxy|cross.family|mcp__|codex/gemini|\(codex/gemini\)|family \(codex|CLI|command not found|track [0-9] \((codex|gemini)\)'

# repo-entering text = git-TRACKED files only (gitignored local notes are not
# repo-entering; and rg's own ignore handling proved order-dependent in the
# suite, so the file list comes from git, not from rg's discovery)
viol=$(git -C "$REPO" ls-files -- \
        'plugins/ae/scripts' 'plugins/ae/tests/scripts' \
        'plugins/ae/skills' 'plugins/ae/agents' 'docs' \
      | grep -v -e 'codex-proxy' -e 'gemini-proxy' -e 'check-cross-family.sh' \
                -e '\.deprecated$' -e 'test-jargon-tripwire.sh' \
      | sed "s|^|$REPO/|" \
      | xargs rg -n -i --no-ignore "$PATTERN" 2>/dev/null \
      | rg -v -i "$FUNC" || true)

if [ -z "$viol" ]; then
  ok "no reviewer-attribution bookkeeping in shipped surfaces"
else
  notok "no reviewer-attribution bookkeeping in shipped surfaces:
$viol"
fi

# the tripwire itself must still catch a violation (mutation guard)
tmp=$(mktemp)
echo "a comment (codex P2: should be caught)" > "$tmp"
if rg -q -i "$PATTERN" "$tmp"; then
  ok "pattern still catches a planted violation"
else
  notok "pattern still catches a planted violation"
fi
rm -f "$tmp"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
