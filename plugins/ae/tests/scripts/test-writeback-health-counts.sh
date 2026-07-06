#!/bin/sh
# F-078 minor: writeback-health counts EDGES (from the `N edge(s)` the add-edges
# log records) not add-edges events, and counts DISTINCT page ids toward the dedup
# tripwire not add-page events (a rewritten page must not inflate the tripwire).
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HEALTH="$REPO/plugins/ae/scripts/graph-writeback-health.py"
PY="${PYTHON:-python3}"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
GRAPH="$TMP/graph"; mkdir -p "$GRAPH"
EMPTY="$TMP/notraces"; mkdir -p "$EMPTY"

# one add-edges batch of 3 edges (single source), + the SAME page added twice
cat > "$GRAPH/log.md" <<'EOF'
- 2026-07-06T00:00:00Z add-edges: F-800: 3 edge(s) [lint]
- 2026-07-06T00:00:01Z add-page: syn-dup (2 anchor(s))
- 2026-07-06T00:00:02Z add-page: syn-dup (2 anchor(s))
EOF

out=$("$PY" "$HEALTH" --graph-dir "$GRAPH" --traces-dir "$EMPTY" 2>&1)

# 1. accepted edges reflect the 3 edges, not 1 add-edges event
if printf '%s\n' "$out" | grep -q 'lint: 3'; then
  ok "accepted edges counted as edges (lint: 3, not 1)"
else
  notok "accepted edges counted as edges (lint: 3) [$(printf '%s' "$out" | grep -i 'accepted edges')]"
fi

# 2. dedup tripwire counts the ONE distinct page, not 2 add-page events
if printf '%s\n' "$out" | grep -q 'batch pages since last dedup pass: 1'; then
  ok "dedup tripwire counts distinct pages (1, not 2)"
else
  notok "dedup tripwire counts distinct pages (1) [$(printf '%s' "$out" | grep -i 'dedup pass')]"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
