#!/bin/sh
# AC5a (F-069 Step 5): deterministic edge-traversal branches on graph content + prose is wired.
# sh-tap output (parser: sh-tap.v1).
#
# HONESTY SCOPE (plan Design note 1/3): this tests the DETERMINISTIC skeleton of the
# cold-start locate-step — grep isolation + node-read + the 1-hop edge traversal via
# wiki-neighbors.py (the ONE real implementation the analyze prose also invokes) —
# NOT the LLM theme-pick (that is AC5b's judge rubric). No live skill invocation
# (no headless harness exists in-repo); the prose-is-wired half is the structural
# grep in part 2.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
NEIGH="$REPO/plugins/ae/scripts/wiki-neighbors.py"
SKILL="$REPO/plugins/ae/skills/analyze/SKILL.md"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# ---------- divergent fixture pair: identical trees differing ONLY in one edge ----------
# keywords are disjoint by construction: F-950 is about "quantile-parser calibration",
# F-951 about "hydration ledger reconciliation" — grep on the survivor's entities
# CANNOT reach the target; the relates_to edge is the isolated causal variable.
make_pair_tree(){ # $1 = root, $2 = with_edge (1/0)
  mkdir -p "$1/done/F-950-survivor" "$1/done/F-951-target"
  if [ "$2" = "1" ]; then
    cat > "$1/done/F-950-survivor/index.md" <<'EOF'
---
id: F-950
title: "Fixture — survivor node (quantile-parser calibration)"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-951
    source: "index.md:2"
    evidence: "the calibration decision superseded the ledger's rounding rule"
    written_by: human
---

# F-950 — quantile-parser calibration

Everything here speaks only of quantile-parser calibration drift.
EOF
  else
    cat > "$1/done/F-950-survivor/index.md" <<'EOF'
---
id: F-950
title: "Fixture — survivor node (quantile-parser calibration)"
status: done
created: 2026-07-03
---

# F-950 — quantile-parser calibration

Everything here speaks only of quantile-parser calibration drift.
EOF
  fi
  cat > "$1/done/F-951-target/index.md" <<'EOF'
---
id: F-951
title: "Fixture — target node (hydration ledger reconciliation)"
status: done
created: 2026-07-03
---

# F-951 — hydration ledger reconciliation

Nothing here mentions the survivor's domain vocabulary at all.
EOF
}
make_pair_tree "$tmp/with-edge" 1
make_pair_tree "$tmp/without-edge" 0

# --- precondition: grep-alone CANNOT reach the target (keyword isolation) ---
if rg -l 'quantile-parser' "$tmp/with-edge" 2>/dev/null | grep -q 'F-951'; then
  notok "keyword isolation: survivor's entities never appear in the target page"
else
  ok "keyword isolation: survivor's entities never appear in the target page"
fi

# --- divergent output: traversal reaches F-951 ONLY when the edge exists ---
outA=$(python3 "$NEIGH" --root "$tmp/with-edge" F-950 2>&1); rcA=$?
outB=$(python3 "$NEIGH" --root "$tmp/without-edge" F-950 2>&1); rcB=$?
[ "$rcA" -eq 0 ] && ok "neighbors exits 0 on edge-present tree" || notok "neighbors exits 0 on edge-present tree (got $rcA)"
[ "$rcB" -eq 0 ] && ok "neighbors exits 0 on edge-absent tree (valid no-edge start, codex)" || notok "neighbors exits 0 on edge-absent tree (got $rcB)"
if printf '%s' "$outA" | rg -q 'F-951'; then
  ok "edge present: traversal output contains F-951 (rg exit 0)"
else
  notok "edge present: traversal output contains F-951 (rg exit 0)"
fi
if printf '%s' "$outB" | rg -q 'F-951'; then
  notok "edge absent: traversal output does NOT contain F-951 (rg exit 1)"
else
  ok "edge absent: traversal output does NOT contain F-951 (rg exit 1)"
fi
# provenance surfaced for LLM consumption: kind + evidence travel with the id
case "$outA" in
  *relates_to*) ok "traversal output carries the edge kind";;
  *) notok "traversal output carries the edge kind";;
esac

# --- usage: unknown start id / bad root ---
python3 "$NEIGH" --root "$tmp/with-edge" F-999 >/dev/null 2>&1
[ $? -eq 2 ] && ok "unknown start id exits 2 (usage)" || notok "unknown start id exits 2 (usage)"
python3 "$NEIGH" --root "$tmp/no-such" F-950 >/dev/null 2>&1
[ $? -eq 2 ] && ok "nonexistent root exits 2 (usage)" || notok "nonexistent root exits 2 (usage)"

# ---------- part 2: wiring grep (prose-is-wired — F-067 lesson) ----------
# the Prior-context section must now be the graph locate-step, not memory_search
section=$(sed -n '/^### Prior context/,/^### Synthesize/p' "$SKILL")
case "$section" in
  *".ae/wiki"*) ok "locate-step reads the .ae/wiki layered index";;
  *) notok "locate-step reads the .ae/wiki layered index";;
esac
case "$section" in
  *wiki-neighbors.py*) ok "locate-step invokes wiki-neighbors.py for the 1-hop traversal";;
  *) notok "locate-step invokes wiki-neighbors.py for the 1-hop traversal";;
esac
case "$section" in
  *memory_search*) notok "memory_search call replaced in the Prior-context section";;
  *) ok "memory_search call replaced in the Prior-context section";;
esac
case "$section" in
  *"## Prior Art from Project Knowledge Base"*) ok "render heading preserved";;
  *) notok "render heading preserved";;
esac
# :312 output-template heading renamed away from Mengdie
if grep -q '^### Mengdie prior art' "$SKILL"; then
  notok "output-template heading no longer says Mengdie"
else
  ok "output-template heading no longer says Mengdie"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
