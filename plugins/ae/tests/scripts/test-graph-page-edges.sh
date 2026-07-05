#!/bin/sh
# Synthesis pages are edge-bearing nodes (F-076 leaf-only reversal): page
# edges are written/removed through the machine path only (add-edges /
# remove-edges resolve file-shaped syn nodes), a refused/reverted write
# leaves the page byte-identical, and graph-page-check validates page
# edges with the SAME shared core (identical defect wording as lint).
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPTS="$REPO/plugins/ae/scripts"
FIX="$REPO/plugins/ae/tests/fixtures/graph-topology"
PY="${PYTHON:-python3}"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$FIX" "$TMP/tree"
ROOT="$TMP/tree/features"
SYN="$TMP/tree/graph/synthesis"
PAGE="$SYN/syn-alpha-arch.md"

# --- 1. page-check validates page edges: planted bad page fails with the
#        SAME named defects lint would produce (shared validation core)
out="$("$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$SYN/syn-gamma-bad.md" 2>&1)"
rc=$?
[ $rc -ne 0 ] && ok "bad page edges = DEFECT exit" || notok "bad page edges = DEFECT exit"
case "$out" in *"dangling target 'syn-missing' (no such syn node)"*) ok "page dangling syn target named (identical wording)";; *) notok "page dangling syn target named (identical wording) ($out)";; esac
case "$out" in *"kind 'origin' not legal from syn to BL"*) ok "page illegal combo named (identical wording)";; *) notok "page illegal combo named (identical wording)";; esac

# --- 2. valid page edges pass (positive syn→syn case)
out2="$("$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$PAGE" 2>&1)"
rc2=$?
[ $rc2 -eq 0 ] && ok "valid syn→syn page edge passes" || notok "valid syn→syn page edge passes ($out2)"

# --- 3. whole-tree lint surfaces page-edge defects (pages are in the tree gate)
out3="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
case "$out3" in *"syn-gamma-bad"*"dangling target 'syn-missing'"*|*"dangling target 'syn-missing'"*) ok "whole-tree gate carries page-edge defects";; *) notok "whole-tree gate carries page-edge defects";; esac

# --- 4. add-edges writes INTO a page file (machine path, file-shaped node)
cat > "$TMP/add.json" <<'JSON'
[{"from": "syn-alpha-arch", "kind": "part_of", "target": "syn-beta-arch",
  "evidence": "alpha is a component of beta's platform", "rationale": "fixture judgment"}]
JSON
out4="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/add.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc4=$?
[ $rc4 -eq 0 ] && ok "add-edges accepts a syn-source row" || notok "add-edges accepts a syn-source row ($out4)"
grep -q "kind: part_of" "$PAGE" && ok "page frontmatter gained the edge" || notok "page frontmatter gained the edge"
"$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$PAGE" >/dev/null 2>&1 \
  && ok "page still valid after machine write" || notok "page still valid after machine write"
grep -q "add-edges: syn-alpha-arch" "$TMP/tree/graph/log.md" 2>/dev/null \
  && ok "mutation logged for the page write" || notok "mutation logged for the page write"

# --- 4b. relates_to on a page writes REPO-RELATIVE source provenance
#         (feature edges write node-dir-relative "index.md:N" — pages differ)
relline=$(grep -n "Alpha architecture relates to F-901" "$PAGE" | cut -d: -f1)
cat > "$TMP/rel.json" <<JSON
[{"from": "syn-alpha-arch", "kind": "relates_to", "target": "F-901", "line": $relline,
  "evidence": "page relates to the feature that documents it", "rationale": "fixture judgment"}]
JSON
out4b="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/rel.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc4b=$?
[ $rc4b -eq 0 ] && ok "relates_to page edge with line accepted" || notok "relates_to page edge with line accepted ($out4b)"
grep -q 'source: "graph/synthesis/syn-alpha-arch.md:' "$PAGE" \
  && ok "page relates_to source is repo-relative" || notok "page relates_to source is repo-relative"
"$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$PAGE" >/dev/null 2>&1 \
  && ok "page valid with sourced relates_to edge" || notok "page valid with sourced relates_to edge"

# --- 5. idempotence: identical row skips
out5="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/add.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
case "$out5" in *"already present — skipped"*) ok "identical page edge skipped (idempotent)";; *) notok "identical page edge skipped (idempotent)";; esac

# --- 6. refused write leaves the page byte-identical (illegal combo reverts)
before="$(cat "$PAGE")"
cat > "$TMP/bad.json" <<'JSON'
[{"from": "syn-alpha-arch", "kind": "origin", "target": "BL-901",
  "evidence": "illegal", "rationale": "must revert"}]
JSON
out6="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/bad.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc6=$?
[ $rc6 -ne 0 ] && ok "illegal page edge write fails" || notok "illegal page edge write fails"
after="$(cat "$PAGE")"
[ "$before" = "$after" ] && ok "reverted page byte-identical" || notok "reverted page byte-identical"

# --- 7. remove-edges works on page nodes through the same machine path
cat > "$TMP/rm.json" <<'JSON'
[{"from": "syn-alpha-arch", "kind": "part_of", "target": "syn-beta-arch"}]
JSON
out7="$("$PY" "$SCRIPTS/graph-refresh.py" remove-edges "$TMP/rm.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc7=$?
[ $rc7 -eq 0 ] && ok "remove-edges removes a page edge" || notok "remove-edges removes a page edge ($out7)"
grep -q "kind: part_of" "$PAGE" && notok "page edge actually gone" || ok "page edge actually gone"
"$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$PAGE" >/dev/null 2>&1 \
  && ok "page valid after removal" || notok "page valid after removal"

# --- 7b. removing the LAST edge drops the edges: key entirely and the page
#         stays valid (the empty-block rewrite path)
cat > "$TMP/rm2.json" <<'JSON'
[{"from": "syn-alpha-arch", "kind": "talks_to", "target": "syn-beta-arch"},
 {"from": "syn-alpha-arch", "kind": "relates_to", "target": "F-901"}]
JSON
out7b="$("$PY" "$SCRIPTS/graph-refresh.py" remove-edges "$TMP/rm2.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc7b=$?
[ $rc7b -eq 0 ] && ok "removing the remaining page edges succeeds" || notok "removing the remaining page edges succeeds ($out7b)"
grep -q '^edges:' "$PAGE" && notok "edges: key gone after last removal" || ok "edges: key gone after last removal"
"$PY" "$SCRIPTS/graph-page-check.py" --repo-root "$TMP/tree" --features-root "$ROOT" "$PAGE" >/dev/null 2>&1 \
  && ok "page valid with no edges key (anchors intact)" || notok "page valid with no edges key (anchors intact)"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
