#!/bin/sh
# AC1 (F-070 Step 3): zero mengdie residue in the live skill surface.
# sh-tap output (parser: sh-tap.v1).
# Allowlist is FULLY ENUMERATED per AC1 (isolated judge: a *.deprecated class
# pattern could silently grow) — exactly these two files carry historical
# dogfood-project-name mentions. A NEW file (including a new .deprecated one)
# fails this test until a human adds it here.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# (a) no MCP call sites anywhere under skills/
hits=$(grep -rlE 'memory_search|memory_ingest|memory_get' "$SKILLS" 2>/dev/null || true)
if [ -z "$hits" ]; then
  ok "no memory_search/memory_ingest/memory_get under plugins/ae/skills/"
else
  notok "no memory_search/memory_ingest/memory_get under plugins/ae/skills/ (hits: $hits)"
fi

# (b) no live Mengdie mention in any SKILL.md outside the enumerated allowlist
viol=""
# scan *.md* so .md.deprecated files are ITERATED (with a bare *.md
# glob the *.deprecated allowlist arm was dead code — false confidence)
for f in $(find "$SKILLS" -name '*.md*' -type f); do
  case "$f" in
    */setup/agent-selection-rubric.md|*/setup/agent-selection-scorer.md.deprecated) continue ;;  # fully enumerated historical allowlist
  esac
  if grep -qi 'mengdie' "$f"; then
    viol="$viol $f"
  fi
done
if [ -z "$viol" ]; then
  ok "no live Mengdie mention outside the enumerated allowlist"
else
  notok "no live Mengdie mention outside the enumerated allowlist (violations:$viol)"
fi

# (c) shared protocol doc deleted
if [ ! -f "$REPO/plugins/ae/docs/knowledge-capture-protocol.md" ]; then
  ok "knowledge-capture-protocol.md deleted"
else
  notok "knowledge-capture-protocol.md deleted"
fi

# (d) PRD archived: old path absent, archive path present with retirement header
if [ ! -f "$REPO/docs/prd/mengdie-integration.md" ]; then
  ok "old PRD path absent"
else
  notok "old PRD path absent"
fi
if [ -f "$REPO/docs/prd/archive/mengdie-integration.md" ] && \
   grep -qi 'retired' "$REPO/docs/prd/archive/mengdie-integration.md"; then
  ok "archived PRD present with retirement header"
else
  notok "archived PRD present with retirement header"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
