#!/bin/sh
# The knowledge-graph corpus is version-controlled: .ae/graph/ is carved out of
# the blanket .ae/ gitignore (user ruling, F-076) while the rest of .ae/ stays
# ignored. Untracked graph history is unrecoverable; everything else in .ae/
# remains local-only process state.
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO" || exit 2

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# 1. .ae/graph/ content is NOT ignored
if git check-ignore -q .ae/graph/index.md 2>/dev/null; then
  notok ".ae/graph/index.md is not gitignored"
else
  ok ".ae/graph/index.md is not gitignored"
fi

if git check-ignore -q .ae/graph/log.md 2>/dev/null; then
  notok ".ae/graph/log.md is not gitignored"
else
  ok ".ae/graph/log.md is not gitignored"
fi

# 2. nested paths are tracked too — the layer where a directory-negation
#    mistake would actually surface (top-level files can ride along while
#    nested ones stay silently ignored)
if git check-ignore -q .ae/graph/synthesis/syn-knowledge-graph.md 2>/dev/null; then
  notok "nested synthesis page is not gitignored"
else
  ok "nested synthesis page is not gitignored"
fi

if [ "$(git ls-files '.ae/graph/synthesis/*.md' | wc -l | tr -d ' ')" -ge 1 ]; then
  ok "nested synthesis pages tracked"
else
  notok "nested synthesis pages tracked"
fi

# two levels deep — themes/ is empty whenever the features root holds no nodes,
# so the second witness is a directory whose contents do not track the corpus
if [ "$(git ls-files '.ae/graph/archive/themes/*.md' | wc -l | tr -d ' ')" -ge 1 ]; then
  ok "two-level-nested files tracked"
else
  notok "two-level-nested files tracked"
fi

# 3. the whole corpus is tracked, not just a couple of riders (15 files at
#    carve-out time; grows over time — floor, not exact match)
if [ "$(git ls-files .ae/graph/ | wc -l | tr -d ' ')" -ge 15 ]; then
  ok "corpus tracked: git ls-files .ae/graph/ lists >= 15 files"
else
  notok "corpus tracked: git ls-files .ae/graph/ lists >= 15 files"
fi

# 4. the rest of .ae/ remains ignored (carve-out is surgical, not a hole)
if git check-ignore -q .ae/backlog/unscheduled 2>/dev/null || git check-ignore -q .ae/backlog 2>/dev/null; then
  ok "rest of .ae/ still ignored (.ae/backlog)"
else
  notok "rest of .ae/ still ignored (.ae/backlog)"
fi

if git check-ignore -q .ae/features/active 2>/dev/null || git check-ignore -q .ae/features 2>/dev/null; then
  ok "rest of .ae/ still ignored (.ae/features)"
else
  notok "rest of .ae/ still ignored (.ae/features)"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
