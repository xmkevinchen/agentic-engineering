#!/bin/sh
# AC6 (F-069 Step 6): end-to-end producer→consumer — a real write is really read.
# sh-tap output (parser: sh-tap.v1).
#
# The PRODUCER is the same frontmatter-append mechanism the Step-4 archive
# logic-sim exercises (and the Step-6 seed used on the real corpus), emitting
# the identical on-disk edge shape; the CONSUMER is Step 5's actual traversal
# implementation (wiki-neighbors.py — the one shared implementation, not a
# reimplementation). The writer's actual output frontmatter IS the reader's
# actual input — closing the two-independently-hand-built-fixtures seam.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LINT="$REPO/plugins/ae/scripts/wiki-lint.py"
NEIGH="$REPO/plugins/ae/scripts/wiki-neighbors.py"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

mkdir -p "$tmp/done/F-960-producer" "$tmp/done/F-961-consumed"
cat > "$tmp/done/F-960-producer/index.md" <<'EOF'
---
id: F-960
title: "Fixture — feature finishing archive (producer side)"
status: done
created: 2026-07-03
---

# F-960 — producer

The archive writer appends its edge into THIS file's frontmatter.
EOF
cat > "$tmp/done/F-961-consumed/index.md" <<'EOF'
---
id: F-961
title: "Fixture — sibling the traversal must reach (consumer side)"
status: done
created: 2026-07-03
---

# F-961 — consumed target
EOF

# --- baseline: BEFORE the producer runs, the consumer reaches nothing ---
out=$(python3 "$NEIGH" --root "$tmp" F-960 2>&1); rc=$?
if [ "$rc" -eq 0 ] && ! printf '%s' "$out" | rg -q 'F-961'; then
  ok "pre-write baseline: traversal reaches nothing (no edge yet)"
else
  notok "pre-write baseline: traversal reaches nothing (rc=$rc)"
fi

# --- PRODUCER: append the edge exactly as the archive writer does (Step 4 sim
#     mechanism; identical on-disk shape to the Step 6 seeds) ---
cat > "$tmp/edge.yaml" <<'EOF'
edges:
  - kind: relates_to
    id: F-961
    source: "index.md:2"
    evidence: "producer and consumer share the fixture lineage"
    written_by: review-archive
    judge: {value: pass, rationale: "e2e fixture relationship"}
EOF
awk -v ef="$tmp/edge.yaml" 'BEGIN{c=0} /^---$/{c++; if(c==2){while((getline l < ef)>0) print l}} {print}' \
  "$tmp/done/F-960-producer/index.md" > "$tmp/idx.new" && mv "$tmp/idx.new" "$tmp/done/F-960-producer/index.md"

# the produced edge must clear the same trust gate the archive runs
if python3 "$LINT" --root "$tmp" "$tmp/done/F-960-producer" >/dev/null 2>&1; then
  ok "produced edge clears the wiki-lint trust gate"
else
  notok "produced edge clears the wiki-lint trust gate"
fi

# --- CONSUMER: Step 5's actual traversal over the writer's actual output ---
out=$(python3 "$NEIGH" --root "$tmp" F-960 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "consumer traversal exits 0" || notok "consumer traversal exits 0 (got $rc)"
if printf '%s' "$out" | rg -q 'F-961'; then
  ok "traversal reaches the produced edge's target (write IS read)"
else
  notok "traversal reaches the produced edge's target (write IS read)"
fi
case "$out" in
  *"producer and consumer share the fixture lineage"*)
    ok "the produced evidence line travels through to the consumer";;
  *) notok "the produced evidence line travels through to the consumer";;
esac

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
