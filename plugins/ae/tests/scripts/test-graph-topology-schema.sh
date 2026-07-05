#!/bin/sh
# Topology schema validates end-to-end on mixed-family fixtures (F+BL+syn):
# valid syn-target + documented_by edges pass; dangling syn target, illegal
# source/target combo, and unknown id prefix are NAMED defects; the shared
# graph_common module is the only home for kind knowledge (no divergent
# copies in any graph script); lint and refresh report the identical
# legality defect for the same illegal fixture.
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

# --- 1. whole-tree lint: planted defects are NAMED, valid edges are not flagged
out="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
rc=$?
[ $rc -eq 1 ] && ok "whole-tree exits 1 on planted defects" || notok "whole-tree exits 1 on planted defects (rc=$rc)"

case "$out" in *"dangling target 'syn-missing'"*) ok "dangling syn target named";; *) notok "dangling syn target named";; esac
case "$out" in *"kind 'part_of' not legal from F to F"*) ok "illegal source/target combo named";; *) notok "illegal source/target combo named";; esac
case "$out" in *"unclassifiable target id 'X-99'"*) ok "unknown prefix named (falls-to-disc bug pinned)";; *) notok "unknown prefix named (falls-to-disc bug pinned)";; esac
case "$out" in *"dangling target 'syn-nope'"*) ok "dangling syn target caught on the LEGAL kind too (documented_by)";; *) notok "dangling syn target caught on the LEGAL kind too (documented_by)";; esac
case "$out" in *"F-901"*) notok "valid node F-901 not flagged";; *) ok "valid node F-901 not flagged";; esac

# --- 2. scoped lint on the VALID node passes (syn target + documented_by resolve
#        in scoped mode — the archive gate's shape)
out2="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" "$ROOT/active/F-901-alpha" 2>&1)"
rc2=$?
[ $rc2 -eq 0 ] && ok "scoped lint: valid syn edges pass" || notok "scoped lint: valid syn edges pass ($out2)"

# --- 3. refresh add-edges reports the IDENTICAL legality defect for the same
#        illegal combo (shared module, one wording) and reverts
cat > "$TMP/bad.json" <<'JSON'
[{"from": "F-901", "kind": "part_of", "target": "F-902", "line": 20,
  "evidence": "illegal combo fixture", "rationale": "must be reverted"}]
JSON
before="$(cat "$ROOT/active/F-901-alpha/index.md")"
out3="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/bad.json" --root "$ROOT" 2>&1)"
rc3=$?
[ $rc3 -ne 0 ] && ok "refresh rejects illegal-combo row (non-zero exit)" || notok "refresh rejects illegal-combo row (non-zero exit)"
case "$out3" in *"kind 'part_of' not legal from F to F"*) ok "refresh reports the identical legality defect wording";; *) notok "refresh reports the identical legality defect wording ($out3)";; esac
after="$(cat "$ROOT/active/F-901-alpha/index.md")"
[ "$before" = "$after" ] && ok "refresh reverted: node byte-identical" || notok "refresh reverted: node byte-identical"

# --- 4. refresh rejects an unclassifiable target BEFORE writing
cat > "$TMP/badid.json" <<'JSON'
[{"from": "F-901", "kind": "relates_to", "target": "Q-77", "line": 20,
  "evidence": "unknown prefix fixture", "rationale": "must be rejected"}]
JSON
out4="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/badid.json" --root "$ROOT" 2>&1)"
rc4=$?
[ $rc4 -ne 0 ] && ok "refresh rejects unclassifiable target id" || notok "refresh rejects unclassifiable target id"
case "$out4" in *"unclassifiable target id 'Q-77'"*) ok "refresh names the unclassifiable id";; *) notok "refresh names the unclassifiable id ($out4)";; esac

# --- 5. kind knowledge lives ONLY in graph_common (no divergent copies)
copies=0
for s in graph-lint.py graph-refresh.py graph-page-check.py graph-neighbors.py graph-index-gen.py; do
  if grep -qE '^(KIND_ENUM|LEGALITY|INVERSE|WRITER_ENUM)[[:space:]]*=' "$SCRIPTS/$s"; then
    copies=$((copies+1)); echo "# local kind table in $s"
  fi
done
[ "$copies" -eq 0 ] && ok "no graph script defines a local kind table" || notok "no graph script defines a local kind table ($copies found)"

for s in graph-lint.py graph-refresh.py graph-page-check.py; do
  if grep -q 'graph_common' "$SCRIPTS/$s"; then
    ok "$s imports graph_common"
  else
    notok "$s imports graph_common"
  fi
done

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
