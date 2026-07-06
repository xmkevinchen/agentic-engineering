#!/bin/sh
# candidates: an edgeless F-NNN mention already carrying a durable `rejected:`
# ledger record for the same (from, target) pair is suppressed from the candidate
# output — the scan stops re-proposing rows the judge already refused. A mention
# with NO rejection record still emits (suppression must not be vacuous).
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REFRESH="$REPO/plugins/ae/scripts/graph-refresh.py"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ROOT="$TMP/.ae/features"
GRAPH="$TMP/.ae/graph"
mkdir -p "$ROOT/active/F-801-src" "$GRAPH"

# F-801 body mentions F-802 (will be rejected) and F-803 (never rejected); neither has an edge.
cat > "$ROOT/active/F-801-src/index.md" <<'EOF'
---
id: F-801
title: source node
status: active
created: 2026-07-06
---

# F-801
This work follows on from F-802 and is paired with F-803.
EOF

# durable rejection for the (F-801, F-802) pair only
printf -- '- 2026-07-06T00:00:00Z rejected: F-801: relates_to -> F-802 [untagged] lint-revert\n' > "$GRAPH/log.md"

out=$(python3 "$REFRESH" candidates --root "$ROOT" 2>/dev/null)

# 1. rejected pair suppressed
if printf '%s\n' "$out" | awk -F'\t' '$1=="F-801" && $2=="F-802"{f=1} END{exit !f}'; then
  notok "rejected (F-801->F-802) suppressed [still emitted]"
else
  ok "rejected (F-801->F-802) suppressed"
fi

# 2. non-rejected pair still emitted (guards vacuous/over-broad suppression)
if printf '%s\n' "$out" | awk -F'\t' '$1=="F-801" && $2=="F-803"{f=1} END{exit !f}'; then
  ok "non-rejected (F-801->F-803) still emitted"
else
  notok "non-rejected (F-801->F-803) still emitted [wrongly suppressed]"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
