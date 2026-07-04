#!/bin/sh
# Bootstrap synthesis pages: raw-input coverage. Each shipped page carries at
# least one code anchor, one doc anchor, and one resolving commit anchor; the
# page check reports every page fresh; page count stays in the 3-5 band.
# Skips cleanly when no synthesis dir exists (external checkouts have none —
# .ae/ is process state, not shipped content).
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CHECK="$REPO/plugins/ae/scripts/graph-page-check.py"
SYN="$REPO/.ae/graph/synthesis"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

if [ ! -d "$SYN" ]; then
  ok "no synthesis dir in this checkout — coverage check skipped"
  echo "1..1"
  exit 0
fi

count=$(ls "$SYN"/syn-*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -ge 3 ] && [ "$count" -le 5 ]; then
  ok "page count in the 3-5 band ($count)"
else
  notok "page count in the 3-5 band ($count)"
fi

for f in "$SYN"/syn-*.md; do
  id=$(basename "$f" .md)
  fm=$(awk '/^---$/{n++; next} n==1' "$f")
  sources=$(printf '%s' "$fm" | grep 'source:' | sed 's/.*source: "//; s/".*//')
  code=0; doc=0
  for s in $sources; do
    p=${s%:*}
    case "$p" in
      *.py|*.sh|*.json) code=1 ;;
      docs/*|*.md) doc=1 ;;
    esac
  done
  [ "$code" = "1" ] && ok "$id: has a code anchor" || notok "$id: has a code anchor"
  [ "$doc" = "1" ] && ok "$id: has a doc anchor" || notok "$id: has a doc anchor"
  commit=$(printf '%s' "$fm" | grep 'commit:' | head -1 | awk '{print $2}')
  if [ -n "$commit" ] && git -C "$REPO" cat-file -e "$commit" 2>/dev/null; then
    ok "$id: has a resolving commit anchor"
  else
    notok "$id: has a resolving commit anchor"
  fi
  out=$(python3 "$CHECK" --repo-root "$REPO" "$f" 2>&1); rc=$?
  if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q "$id: fresh"; then
    ok "$id: page check fresh"
  else
    notok "$id: page check fresh (rc=$rc out=$out)"
  fi
done

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
