#!/bin/sh
# Cross-domain + bidirectional traversal (F-076): an F node reaches a syn page
# via documented_by and continues syn→syn; a node with only INBOUND edges is
# reached from its edge-source (the F-069→F-072 gap class); directional kinds
# display inverted labels; a 2-hop chain crossing one reverse edge resolves
# fully; and NO-MIRRORING pin — traversal never writes into any node file.
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

sum_before="$(find "$TMP/tree" -type f -name '*.md' -exec cat {} + | cksum)"

# --- 1. cross-domain forward: F-901 reaches its syn page, and 2 hops continue syn→syn
out="$("$PY" "$SCRIPTS/graph-neighbors.py" --root "$ROOT" --synthesis-root "$SYN" --hops 2 F-901 2>&1)"
case "$out" in *"syn-alpha-arch	documented_by	F-901"*) ok "F node reaches syn page via documented_by";; *) notok "F node reaches syn page via documented_by ($out)";; esac
case "$out" in *"syn-beta-arch	talks_to	syn-alpha-arch"*) ok "traversal continues syn→syn (hop 2)";; *) notok "traversal continues syn→syn (hop 2)";; esac

# --- 2. reverse: F-902 has ZERO outgoing edges but is reached FROM F-901 —
#        starting at F-902 must find F-901 via the inverse read (the gap class)
out2="$("$PY" "$SCRIPTS/graph-neighbors.py" --root "$ROOT" --synthesis-root "$SYN" F-902 2>&1)"
rc2=$?
[ $rc2 -eq 0 ] && ok "inbound-only node is a legal start" || notok "inbound-only node is a legal start ($out2)"
case "$out2" in *"F-901	relates_to	F-902"*) ok "reverse reach: source found from its target";; *) notok "reverse reach: source found from its target ($out2)";; esac

# --- 3. inverse labels on directional kinds: BL-901 ← origin edge reads origin-of
out3="$("$PY" "$SCRIPTS/graph-neighbors.py" --root "$ROOT" --synthesis-root "$SYN" BL-901 2>&1)"
case "$out3" in *"F-901	origin-of	BL-901"*) ok "directional kind displays inverse label (origin-of)";; *) notok "directional kind displays inverse label (origin-of) ($out3)";; esac

# --- 4. 2-hop chain crossing one reverse edge: from syn-beta-arch, hop 1
#        reverse-reaches syn-alpha-arch (talks_to, symmetric label), hop 2
#        reverse-reaches F-901 (documented_by read as documents)
out4="$("$PY" "$SCRIPTS/graph-neighbors.py" --root "$ROOT" --synthesis-root "$SYN" --hops 2 syn-beta-arch 2>&1)"
case "$out4" in *"syn-alpha-arch	talks_to	syn-beta-arch"*) ok "hop 1 reverse: page reached from its target page";; *) notok "hop 1 reverse: page reached from its target page ($out4)";; esac
case "$out4" in *"F-901	documents	syn-alpha-arch"*) ok "hop 2 continues across the reverse edge (documents label)";; *) notok "hop 2 continues across the reverse edge (documents label) ($out4)";; esac

# --- 5. NO-MIRRORING pin (binding constraint 3): every node file byte-identical
sum_after="$(find "$TMP/tree" -type f -name '*.md' -exec cat {} + | cksum)"
[ "$sum_before" = "$sum_after" ] && ok "traversal is read-only: all node files byte-identical" || notok "traversal is read-only: all node files byte-identical"

# --- 6. unknown start still refused
"$PY" "$SCRIPTS/graph-neighbors.py" --root "$ROOT" --synthesis-root "$SYN" F-999 >/dev/null 2>&1
[ $? -eq 2 ] && ok "unknown start id refused (exit 2)" || notok "unknown start id refused (exit 2)"

# --- 7. kind knowledge still centralized: neighbors imports graph_common, no local table
grep -q 'graph_common' "$SCRIPTS/graph-neighbors.py" && ok "graph-neighbors imports graph_common" || notok "graph-neighbors imports graph_common"
grep -qE '^(KIND_ENUM|LEGALITY|INVERSE)[[:space:]]*=' "$SCRIPTS/graph-neighbors.py" \
  && notok "no local kind table in graph-neighbors" || ok "no local kind table in graph-neighbors"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
