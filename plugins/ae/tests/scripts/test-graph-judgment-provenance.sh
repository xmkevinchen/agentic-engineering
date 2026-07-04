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

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
