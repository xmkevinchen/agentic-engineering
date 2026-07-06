#!/bin/sh
# F-078 Fix 2: a `relates_to` syn→syn page edge grounds on a SHARED CONCRETE
# ANCHOR (both pages cite the same file:line), not an id-in-line body mention —
# pages anchor code, never name other pages (§4.5 content contract). No shared
# anchor → REVERT. The overlap path is scoped to page relates_to only: feature→
# feature relates_to and F→syn documented_by keep the id-in-line check unchanged.
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REFRESH="$REPO/plugins/ae/scripts/graph-refresh.py"
PAGECHK="$REPO/plugins/ae/scripts/graph-page-check.py"
PY="${PYTHON:-python3}"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
TREE="$TMP/tree"
ROOT="$TREE/features"
SYN="$TREE/graph/synthesis"
mkdir -p "$ROOT/active/F-810-x" "$ROOT/active/F-811-y" "$SYN" "$TREE/graph"

printf 'ALPHA anchor line\nBETA anchor line\n' > "$TREE/code.py"
git -C "$TREE" init -q && git -C "$TREE" add -A
git -C "$TREE" -c user.email=t@t -c user.name=t commit -qm seed

# feature nodes (F-810 body carries the id-in-line source lines used by AC5)
cat > "$ROOT/active/F-810-x/index.md" <<'EOF'
---
id: F-810
title: x
status: active
created: 2026-07-06
---

# F-810
This line does not name the sibling feature at all.
This feature is documented by syn-aa for its architecture.
EOF
cat > "$ROOT/active/F-811-y/index.md" <<'EOF'
---
id: F-811
title: y
status: active
created: 2026-07-06
---

# F-811
Body.
EOF

# syn-aa + syn-bb SHARE code.py:1 ; syn-cc anchors code.py:2 (no overlap with aa)
mkpage(){ # $1=id $2=anchor-source $3=anchor-hash
  cat > "$SYN/$1.md" <<EOF
---
id: $1
title: "$1"
created: 2026-07-06
written_by: batch
state: fresh
anchors:
  - source: "$2"
    anchor_hash: "$3"
---

Page $1 owns behavior anchored at ($2).
EOF
}
mkpage syn-aa "code.py:1" "ALPHA anchor line"
mkpage syn-bb "code.py:1" "ALPHA anchor line"
mkpage syn-cc "code.py:2" "BETA anchor line"

adde(){ "$PY" "$REFRESH" add-edges "$1" --root "$ROOT" --repo-root "$TREE" 2>&1; }

# --- AC2 positive: relates_to syn-aa→syn-bb, SHARED anchor, NO body-line source
cat > "$TMP/pos.json" <<'JSON'
[{"from": "syn-aa", "kind": "relates_to", "target": "syn-bb",
  "evidence": "both document the alpha behavior", "rationale": "fixture judgment",
  "written_by": "batch"}]
JSON
out=$(adde "$TMP/pos.json"); rc=$?
if [ $rc -eq 0 ] && grep -q 'id: syn-bb' "$SYN/syn-aa.md"; then
  ok "AC2+: shared-anchor relates_to page edge lands"
else
  notok "AC2+: shared-anchor relates_to page edge lands (rc=$rc out=$out)"
fi
if "$PY" "$PAGECHK" --repo-root "$TREE" --features-root "$ROOT" "$SYN/syn-aa.md" >/dev/null 2>&1; then
  ok "AC2+: page still valid after page-edge write (survives page-check)"
else
  notok "AC2+: page still valid after page-edge write"
fi

# --- AC2 negative: relates_to syn-aa→syn-cc, NO shared anchor → REVERT
before=$(cat "$SYN/syn-aa.md")
cat > "$TMP/neg.json" <<'JSON'
[{"from": "syn-aa", "kind": "relates_to", "target": "syn-cc",
  "evidence": "no shared grounding", "rationale": "must revert", "written_by": "batch"}]
JSON
out=$(adde "$TMP/neg.json"); rc=$?
after=$(cat "$SYN/syn-aa.md")
if [ $rc -ne 0 ] && [ "$before" = "$after" ] && ! grep -q 'id: syn-cc' "$SYN/syn-aa.md"; then
  ok "AC2-: no-shared-anchor page edge REVERTS, page byte-identical"
else
  notok "AC2-: no-shared-anchor page edge REVERTS (rc=$rc out=$out)"
fi

# --- AC5a: feature→feature relates_to whose source line lacks the target id REVERTS
#     (F-810 body line 8 does not name F-811 → id-in-line intact for F edges)
badline=$(grep -n 'does not name the sibling' "$ROOT/active/F-810-x/index.md" | cut -d: -f1)
cat > "$TMP/ff.json" <<JSON
[{"from": "F-810", "kind": "relates_to", "target": "F-811", "line": $badline,
  "evidence": "x", "rationale": "must revert", "written_by": "batch"}]
JSON
out=$(adde "$TMP/ff.json"); rc=$?
if [ $rc -ne 0 ] && ! grep -q 'id: F-811' "$ROOT/active/F-810-x/index.md"; then
  ok "AC5a: feature→feature id-in-line check intact (bad source reverts)"
else
  notok "AC5a: feature→feature id-in-line check intact (rc=$rc out=$out)"
fi

# --- AC5b: documented_by F→syn stays on id-in-line (NOT overlap). F-810 shares no
#     anchor with syn-aa, yet its body line NAMES syn-aa → lands via id-in-line.
#     If the overlap path had leaked onto documented_by, this would REVERT.
docline=$(grep -n 'documented by syn-aa' "$ROOT/active/F-810-x/index.md" | cut -d: -f1)
cat > "$TMP/db.json" <<JSON
[{"from": "F-810", "kind": "documented_by", "target": "syn-aa", "line": $docline,
  "evidence": "the page documents this feature", "rationale": "fixture", "written_by": "batch"}]
JSON
out=$(adde "$TMP/db.json"); rc=$?
if [ $rc -eq 0 ] && grep -q 'id: syn-aa' "$ROOT/active/F-810-x/index.md"; then
  ok "AC5b: documented_by uses id-in-line (lands on body mention, not overlap)"
else
  notok "AC5b: documented_by uses id-in-line (rc=$rc out=$out)"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
