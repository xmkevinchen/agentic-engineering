#!/bin/sh
# Graph semantic judgments are never self-judged: the provenance rule is
# stated once in knowledge-refresh and referenced at every judgment point
# (candidate judging, batch re-judging, page gate, write-then-audit, and the
# review archive-edge verdict).
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
KR="$REPO/plugins/ae/skills/knowledge-refresh/SKILL.md"
RV="$REPO/plugins/ae/skills/review/SKILL.md"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

has(){ if grep -q "$2" "$1"; then ok "$3"; else notok "$3"; fi }

has "$KR" 'No semantic judgment in this graph is self-judged' "refresh: the provenance rule is stated"
has "$KR" 'fresh-context agent, independent of the producer' "refresh: independent-agent minimum"
has "$KR" 'solo — degraded' "refresh: degraded solo verdicts are marked for priority re-judge"
has "$KR" 'independently judged' "refresh: candidate judging routes to the independent judge"
has "$KR" 're-judging is where cross-family matters MOST' "refresh: batch re-judge is cross-family-first"
has "$KR" "The page's WRITER never runs this gate on its own page" "refresh: writer never gates own page"
has "$KR" 'Write-then-audit (immediately, not at the next refresh)' "refresh: pages audited at write time"
has "$KR" 'anchored sources FIRST, then verifies the page claim-by-claim' "refresh: write-audit uses the fact-claim shape"
has "$RV" 'INDEPENDENT judge, not the reviewer who proposed the edge' "review: archive-edge verdict is independent"

# F-076: the new judged lint classes + write-back candidates route through the
# same provenance rules (wiring floor)
has "$KR" 'routes through the same independently-judged flow as step 3' "refresh: judged lint classes inherit the provenance rules"
has "$KR" 'independent judge; cross-family when the' "refresh: lint proposals get cross-family when self-authored"
has "$KR" 'with a fresh-context judge (Judgment provenance' "refresh: no-disposition resample judged with provenance"

# exercised, not only grepped: an edge written through the judged path CARRIES
# its verdict in the artifact, and a solo-judged case carries the degraded mark
FIX="$REPO/plugins/ae/tests/fixtures/graph-topology"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$FIX" "$TMP/tree"
cat > "$TMP/solo.json" <<'EOF'
[{"from": "F-901", "kind": "documented_by", "target": "syn-beta-arch",
  "evidence": "fixture page documents alpha's counterpart",
  "rationale": "solo — degraded (same-session producer+judge; fixture)",
  "written_by": "batch", "proposal_source": "lint"}]
EOF
python3 "$REPO/plugins/ae/scripts/graph-refresh.py" add-edges "$TMP/solo.json" \
  --root "$TMP/tree/features" --repo-root "$TMP/tree" >/dev/null 2>&1
if grep -q 'rationale: "solo — degraded' "$TMP/tree/features/active/F-901-alpha/index.md"; then
  ok "e2e: judged edge artifact carries the solo — degraded verdict"
else
  notok "e2e: judged edge artifact carries the solo — degraded verdict"
fi
if grep -q 'add-edges: F-901: 1 edge(s) \[lint\]' "$TMP/tree/graph/log.md" 2>/dev/null; then
  ok "e2e: lint-sourced proposal logged with its source tag"
else
  notok "e2e: lint-sourced proposal logged with its source tag"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
