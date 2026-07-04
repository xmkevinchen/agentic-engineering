#!/bin/sh
# Pull gate: synthesis pages are checked before being read, stale is flagged
# inline, DEFECT pages are never served. Wiring grep across the six
# Prior-Context sections + behavioral fixtures against graph-page-check.py.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"
CHECK="$REPO/plugins/ae/scripts/graph-page-check.py"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

section(){ # Prior-Context section of a skill (heading → next heading)
  awk '/^#+ .*Prior [Cc]ontext/{p=1; print; next} p && /^#+ /{exit} p' "$1"
}

for skill in analyze discuss think plan review plugin-stats; do
  sec=$(section "$SKILLS/$skill/SKILL.md")
  case "$sec" in *graph-page-check.py*) ok "$skill: pull-gate check wired (graph-page-check.py)";; *) notok "$skill: pull-gate check wired (graph-page-check.py)";; esac
  case "$sec" in *"STALE — re-sync via /ae:knowledge-refresh"*) ok "$skill: stale citations carry the inline fix pointer";; *) notok "$skill: stale citations carry the inline fix pointer";; esac
  case "$sec" in *"not served"*) ok "$skill: DEFECT pages are suppressed, not read";; *) notok "$skill: DEFECT pages are suppressed, not read";; esac
done

# behavioral fixtures: the check the skills invoke behaves as the wiring assumes
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAKE="$TMP/repo"
mkdir -p "$FAKE/src" "$FAKE/.ae/graph/synthesis"
printf 'anchored line here\n' > "$FAKE/src/a.txt"
git -C "$FAKE" init -q && git -C "$FAKE" add -A
git -C "$FAKE" -c user.email=t@t -c user.name=t commit -qm seed

cat > "$FAKE/.ae/graph/synthesis/syn-stale.md" <<'EOF'
---
id: syn-stale
title: "stale page"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "src/a.txt:1"
    anchor_hash: "text that drifted"
---
Body.
EOF
out=$(python3 "$CHECK" --repo-root "$FAKE" "$FAKE/.ae/graph/synthesis/syn-stale.md" 2>&1); rc=$?
if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'STALE: syn-stale.*src/a.txt:1' \
   && printf '%s' "$out" | grep -q 'syn-stale: stale'; then
  ok "behavior: stale page → verdict stale + anchor-naming STALE line, exit 0"
else
  notok "behavior: stale page → verdict stale + anchor-naming STALE line, exit 0 (rc=$rc out=$out)"
fi

cat > "$FAKE/.ae/graph/synthesis/syn-broken.md" <<'EOF'
---
id: syn-broken
title: "broken page"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "src/missing.txt:1"
    anchor_hash: "x"
---
Body.
EOF
out=$(python3 "$CHECK" --repo-root "$FAKE" "$FAKE/.ae/graph/synthesis/syn-broken.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT: syn-broken.*src/missing.txt:1'; then
  ok "behavior: DEFECT page → non-zero exit + failing-anchor line"
else
  notok "behavior: DEFECT page → non-zero exit + failing-anchor line (rc=$rc out=$out)"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
