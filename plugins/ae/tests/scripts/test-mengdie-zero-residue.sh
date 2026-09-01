#!/bin/sh
# AC1 (F-070 Step 3): zero mengdie residue in the live skill surface.
# sh-tap output (parser: sh-tap.v1).
# The two files that carried historical dogfood-project-name mentions are gone with the
# skills that held them, so the allowlist is now empty: ANY mention under skills/ fails.
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
# scan *.md* so a *.deprecated file is iterated too, not skipped by a bare *.md glob
for f in $(find "$SKILLS" -name '*.md*' -type f); do
  if grep -qi 'mengdie' "$f"; then
    viol="$viol $f"
  fi
done
if [ -z "$viol" ]; then
  ok "no Mengdie mention under plugins/ae/skills/"
else
  notok "no Mengdie mention under plugins/ae/skills/ (violations:$viol)"
fi

# (c) shared protocol doc deleted
if [ ! -f "$REPO/plugins/ae/docs/knowledge-capture-protocol.md" ]; then
  ok "knowledge-capture-protocol.md deleted"
else
  notok "knowledge-capture-protocol.md deleted"
fi

# (d) the PRD is gone from docs/ entirely — both the live path and the archive path it
# was first moved to. The archive was kept while the integration's replacement still
# existed; that replacement was deleted too, so the document described a direction that
# had been abandoned twice. Git history holds it.
if [ ! -f "$REPO/docs/prd/mengdie-integration.md" ] && \
   [ ! -f "$REPO/docs/prd/archive/mengdie-integration.md" ]; then
  ok "no PRD for the retired integration under docs/"
else
  notok "no PRD for the retired integration under docs/"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
