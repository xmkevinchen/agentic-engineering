#!/bin/sh
# Anchor contract for synthesis pages: graph-page-check.py three-state behavior
# plus graph-lint.py --synthesis-root integration.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CHECK="$REPO/plugins/ae/scripts/graph-page-check.py"
LINT="$REPO/plugins/ae/scripts/graph-lint.py"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# a tiny real git repo to anchor into
FAKE="$TMP/fake-repo"
mkdir -p "$FAKE/src" "$FAKE/docs"
printf 'alpha line one\n  beta   line two\ngamma line three\n' > "$FAKE/src/core.txt"
printf 'doc heading\ndoc body text\n' > "$FAKE/docs/notes.md"
git -C "$FAKE" init -q
git -C "$FAKE" add -A
git -C "$FAKE" -c user.email=t@t -c user.name=t commit -qm seed
HEADSHA="$(git -C "$FAKE" rev-parse HEAD)"

SYN="$FAKE/.ae/graph/synthesis"
mkdir -p "$SYN"

page(){ # $1 = id, $2 = anchors-yaml
  cat > "$SYN/$1.md" <<EOF
---
id: $1
title: "test page"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
$2
---
Body text.
EOF
}

# 1. fresh page: matching path:line + normalized hash + resolving commit
page syn-fresh '  - source: "src/core.txt:1"
    anchor_hash: "alpha line one"
    commit: '"$HEADSHA"
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-fresh.md" 2>&1); rc=$?
if [ $rc -eq 0 ] && ! printf '%s' "$out" | grep -qE 'STALE:|DEFECT:'; then
  ok "fresh page: exit 0, no STALE/DEFECT lines"
else
  notok "fresh page: exit 0, no STALE/DEFECT lines (rc=$rc out=$out)"
fi

# 2. whitespace-only difference in the anchored line stays fresh
page syn-ws '  - source: "src/core.txt:2"
    anchor_hash: "beta line two"'
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-ws.md" 2>&1); rc=$?
if [ $rc -eq 0 ] && ! printf '%s' "$out" | grep -q 'STALE:'; then
  ok "whitespace-normalized hash keeps a reformatted-only line fresh"
else
  notok "whitespace-normalized hash keeps a reformatted-only line fresh (rc=$rc out=$out)"
fi

# 3. hash mismatch: STALE line naming the anchor, exit STILL 0
page syn-stale '  - source: "src/core.txt:1"
    anchor_hash: "text that no longer matches"'
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-stale.md" 2>&1); rc=$?
if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'STALE:.*src/core.txt:1'; then
  ok "hash mismatch: STALE line names the anchor, exit stays 0"
else
  notok "hash mismatch: STALE line names the anchor, exit stays 0 (rc=$rc out=$out)"
fi

# 4. dead path: DEFECT, non-zero exit
page syn-dead '  - source: "src/gone.txt:1"
    anchor_hash: "whatever"'
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-dead.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:.*src/gone.txt:1'; then
  ok "dead path: DEFECT line, non-zero exit"
else
  notok "dead path: DEFECT line, non-zero exit (rc=$rc out=$out)"
fi

# 5. line beyond EOF: DEFECT
page syn-eof '  - source: "src/core.txt:99"
    anchor_hash: "whatever"'
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-eof.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:'; then
  ok "line beyond EOF: DEFECT, non-zero exit"
else
  notok "line beyond EOF: DEFECT, non-zero exit (rc=$rc out=$out)"
fi

# 6. unresolvable commit anchor: DEFECT
page syn-badcommit '  - source: "src/core.txt:1"
    anchor_hash: "alpha line one"
    commit: 0000000000000000000000000000000000000000'
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-badcommit.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:.*commit'; then
  ok "unresolvable commit: DEFECT, non-zero exit"
else
  notok "unresolvable commit: DEFECT, non-zero exit (rc=$rc out=$out)"
fi

# 7. id/basename mismatch: DEFECT
cat > "$SYN/syn-wrongname.md" <<EOF
---
id: syn-other
title: "mismatch"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "src/core.txt:1"
    anchor_hash: "alpha line one"
---
Body.
EOF
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-wrongname.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -qi 'DEFECT:.*id'; then
  ok "frontmatter id != basename: DEFECT"
else
  notok "frontmatter id != basename: DEFECT (rc=$rc out=$out)"
fi

# 8. empty anchors list: DEFECT
cat > "$SYN/syn-noanchor.md" <<EOF
---
id: syn-noanchor
title: "no anchors"
created: 2026-07-04
written_by: batch
state: fresh
anchors: []
---
Body.
EOF
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-noanchor.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:'; then
  ok "empty anchors list: DEFECT"
else
  notok "empty anchors list: DEFECT (rc=$rc out=$out)"
fi

# 9. missing required frontmatter field: DEFECT
cat > "$SYN/syn-nofield.md" <<EOF
---
id: syn-nofield
anchors:
  - source: "src/core.txt:1"
    anchor_hash: "alpha line one"
---
Body.
EOF
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-nofield.md" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:'; then
  ok "missing required frontmatter fields: DEFECT"
else
  notok "missing required frontmatter fields: DEFECT (rc=$rc out=$out)"
fi

# clean out the defect fixtures so only fresh+stale remain for the lint pass
rm -f "$SYN/syn-dead.md" "$SYN/syn-eof.md" "$SYN/syn-badcommit.md" \
      "$SYN/syn-wrongname.md" "$SYN/syn-noanchor.md" "$SYN/syn-nofield.md"

# a feature tree so graph-lint has a features root beside the synthesis dir
FEAT="$FAKE/.ae/features"
mkdir -p "$FEAT/done/F-901-sample"
cat > "$FEAT/done/F-901-sample/index.md" <<'EOF'
---
id: F-901
title: "sample"
status: done
created: 2026-07-04
edges:
  - kind: origin
    id: BL-901
    written_by: human
---
Sample body.
EOF
mkdir -p "$FAKE/.ae/backlog"
: > "$FAKE/.ae/backlog/BL-901-sample.md"

# 10. graph-lint --synthesis-root: stale page surfaces as STALE, exit stays 0
out=$(python3 "$LINT" --root "$FEAT" --synthesis-root "$SYN" --repo-root "$FAKE" 2>&1); rc=$?
if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'STALE:'; then
  ok "lint whole-tree: STALE page surfaced, exit 0"
else
  notok "lint whole-tree: STALE page surfaced, exit 0 (rc=$rc out=$out)"
fi

# 11. graph-lint --synthesis-root: a DEFECT page makes the tree fail
page syn-dead2 '  - source: "src/gone.txt:1"
    anchor_hash: "x"'
out=$(python3 "$LINT" --root "$FEAT" --synthesis-root "$SYN" --repo-root "$FAKE" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'DEFECT:'; then
  ok "lint whole-tree: DEFECT page fails the tree"
else
  notok "lint whole-tree: DEFECT page fails the tree (rc=$rc out=$out)"
fi
rm -f "$SYN/syn-dead2.md"

# 12. graph-lint WITHOUT --synthesis-root on a tree with no synthesis dir:
# output identical to pre-synthesis behavior (no synthesis lines at all)
FEAT2="$TMP/plain/.ae/features"
mkdir -p "$FEAT2/done/F-902-plain"
cat > "$FEAT2/done/F-902-plain/index.md" <<'EOF'
---
id: F-902
title: "plain"
status: done
created: 2026-07-04
edges:
  - kind: origin
    id: BL-902
    written_by: human
---
Plain body.
EOF
mkdir -p "$TMP/plain/.ae/backlog"
: > "$TMP/plain/.ae/backlog/BL-902-plain.md"
out=$(python3 "$LINT" --root "$FEAT2" 2>&1); rc=$?
if [ $rc -eq 0 ] && ! printf '%s' "$out" | grep -qE 'STALE:|synthesis'; then
  ok "lint without synthesis dir: behavior unchanged, no synthesis output"
else
  notok "lint without synthesis dir: behavior unchanged (rc=$rc out=$out)"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
