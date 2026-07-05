#!/bin/sh
# The layered index renders INBOUND edges per node (F-076): cross-references
# are artifact-visible in both directions without mirrored frontmatter —
# derived at generation time, inversion labels from graph_common. Missing
# synthesis dir still omits the tier byte-identically (existing behavior).
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
OUT="$TMP/out"

"$PY" "$SCRIPTS/graph-index-gen.py" --root "$ROOT" --out "$OUT" --synthesis-root "$SYN" >/dev/null 2>&1 \
  && ok "index generates" || notok "index generates"

# --- 1. tier-B member carries its inbound refs with inverse labels
themefile="$(ls "$OUT/themes/"*.md 2>/dev/null | head -1)"
grep -A4 '### F-902' "$themefile" 2>/dev/null | grep -q 'Inbound: relates_to F-901' \
  && ok "F-902 shows inbound relates_to from F-901" || notok "F-902 shows inbound relates_to from F-901"
# NB: F-901 DOES have inbound (F-903's planted part_of edge renders as
# has-part — inbound rendering is mechanical, legality is lint's job);
# F-903 is the genuinely inbound-free node
grep -A4 '### F-903' "$themefile" 2>/dev/null | grep -q 'Inbound:' \
  && notok "F-903 (no inbound) has no Inbound line" || ok "F-903 (no inbound) has no Inbound line"
grep -A6 '### F-901' "$themefile" 2>/dev/null | grep -q 'Inbound: has-part F-903' \
  && ok "F-901 shows inbound part_of as has-part (mechanical, not legality-filtered)" || notok "F-901 shows inbound part_of as has-part (mechanical, not legality-filtered)"

# --- 2. synthesis tier rows carry inbound refs (documented_by reads documents...
#        from the page's side the FEATURE's edge points AT the page)
grep -q 'syn-alpha-arch.*← .*documents F-901' "$OUT/index.md" \
  && ok "syn page row shows inbound documented_by (documents label)" || notok "syn page row shows inbound documented_by (documents label)"
grep -q 'syn-beta-arch.*← .*talks_to syn-alpha-arch' "$OUT/index.md" \
  && ok "syn page row shows inbound talks_to" || notok "syn page row shows inbound talks_to"

# --- 3. byte-idempotent with inbound rendering
"$PY" "$SCRIPTS/graph-index-gen.py" --root "$ROOT" --out "$OUT.2" --synthesis-root "$SYN" >/dev/null 2>&1
diff -r "$OUT" "$OUT.2" >/dev/null 2>&1 && ok "idempotent (same bytes on re-run)" || notok "idempotent (same bytes on re-run)"

# --- 4. missing synthesis dir: tier omitted; feature Inbound lines survive
"$PY" "$SCRIPTS/graph-index-gen.py" --root "$ROOT" --out "$OUT.3" --synthesis-root "$TMP/nope" >/dev/null 2>&1
grep -q '## Synthesis pages' "$OUT.3/index.md" \
  && notok "missing synthesis dir omits the tier" || ok "missing synthesis dir omits the tier"
themefile3="$(ls "$OUT.3/themes/"*.md 2>/dev/null | head -1)"
grep -q 'Inbound: relates_to F-901' "$themefile3" \
  && ok "feature inbound lines independent of synthesis dir" || notok "feature inbound lines independent of synthesis dir"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
