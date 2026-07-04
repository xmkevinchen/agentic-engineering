#!/bin/sh
# Append-only mutation log + write-back page validity: every successful
# graph-refresh.py mutation appends exactly one record; the old log is always
# an exact byte-prefix of the new log; refused/reverted writes log nothing;
# a write-back-authored page passes the page check. Wiring: the analyze
# locate-step carries the write-back rule.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REFRESH="$REPO/plugins/ae/scripts/graph-refresh.py"
CHECK="$REPO/plugins/ae/scripts/graph-page-check.py"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAKE="$TMP/repo"
mkdir -p "$FAKE/src" "$FAKE/.ae/features/done/F-940-alpha" "$FAKE/.ae/features/done/F-941-beta" \
         "$FAKE/.ae/backlog"
printf 'stable anchored text\n' > "$FAKE/src/a.txt"
cat > "$FAKE/.ae/features/done/F-940-alpha/index.md" <<'EOF'
---
id: F-940
title: "alpha"
status: done
created: 2026-07-04
---
Body relates to F-941 by design.
EOF
cat > "$FAKE/.ae/features/done/F-941-beta/index.md" <<'EOF'
---
id: F-941
title: "beta"
status: done
created: 2026-07-04
---
Beta body.
EOF
git -C "$FAKE" init -q && git -C "$FAKE" add -A
git -C "$FAKE" -c user.email=t@t -c user.name=t commit -qm seed
ROOT="$FAKE/.ae/features"
SYN="$FAKE/.ae/graph/synthesis"
LOG="$FAKE/.ae/graph/log.md"

# 1. add-edges appends exactly one record
cat > "$TMP/edges.json" <<'EOF'
[{"from": "F-940", "kind": "relates_to", "target": "F-941", "line": 7,
  "evidence": "alpha builds on beta", "rationale": "test"}]
EOF
python3 "$REFRESH" add-edges "$TMP/edges.json" --root "$ROOT" >/dev/null 2>&1
n=$(grep -c 'add-edges' "$LOG" 2>/dev/null || echo 0)
[ "$n" = "1" ] && ok "add-edges appends exactly one log record" \
               || notok "add-edges appends exactly one log record (n=$n)"

# 2. add-page appends exactly one record; old log is a byte-prefix of the new
cp "$LOG" "$TMP/log-before"
cat > "$TMP/page.json" <<'EOF'
{"id": "syn-writeback", "title": "written back from a locate-step",
 "anchors": [{"source": "src/a.txt:1", "anchor_hash": "stable anchored text"}],
 "body": "Novel understanding grounded at (src/a.txt:1)."}
EOF
python3 "$REFRESH" add-page "$TMP/page.json" --synthesis-root "$SYN" >/dev/null 2>&1
n=$(grep -c 'add-page' "$LOG")
size_before=$(wc -c < "$TMP/log-before")
if [ "$n" = "1" ] && head -c "$size_before" "$LOG" | cmp -s - "$TMP/log-before"; then
  ok "add-page appends one record; prior log is an exact byte-prefix"
else
  notok "add-page appends one record; prior log is an exact byte-prefix (n=$n)"
fi

# 3. a refused write leaves the log byte-identical
cp "$LOG" "$TMP/log-mid"
sed 's/Novel understanding/Different content now/' "$TMP/page.json" > "$TMP/page2.json"
python3 "$REFRESH" add-page "$TMP/page2.json" --synthesis-root "$SYN" >/dev/null 2>&1
cmp -s "$LOG" "$TMP/log-mid" && ok "refused write: log byte-identical" \
                             || notok "refused write: log byte-identical"

# 4. a reverted write (dead anchor) leaves the log byte-identical
cat > "$TMP/page3.json" <<'EOF'
{"id": "syn-dead", "title": "dead anchor",
 "anchors": [{"source": "src/gone.txt:1", "anchor_hash": "x"}],
 "body": "Cites (src/gone.txt:1)."}
EOF
python3 "$REFRESH" add-page "$TMP/page3.json" --synthesis-root "$SYN" >/dev/null 2>&1
cmp -s "$LOG" "$TMP/log-mid" && ok "reverted write: log byte-identical" \
                             || notok "reverted write: log byte-identical"

# 5. the write-back-authored page passes the page check
out=$(python3 "$CHECK" --repo-root "$FAKE" "$SYN/syn-writeback.md" 2>&1); rc=$?
[ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'syn-writeback: fresh' \
  && ok "write-back page passes the page check fresh" \
  || notok "write-back page passes the page check fresh (rc=$rc out=$out)"

# 6. backfill logs once when it writes (and not when idempotent-empty)
mkdir -p "$FAKE/.ae/features/done/F-942-legacy"
cat > "$FAKE/.ae/features/done/F-942-legacy/index.md" <<'EOF'
---
id: F-942
title: "legacy fields"
status: done
created: 2026-07-04
depends_on: [F-941]
---
Legacy body.
EOF
python3 "$REFRESH" backfill --root "$ROOT" >/dev/null 2>&1
n=$(grep -c 'backfill' "$LOG")
[ "$n" = "1" ] && ok "backfill logs one record when it writes" \
               || notok "backfill logs one record when it writes (n=$n)"
cp "$LOG" "$TMP/log-after-bf"
python3 "$REFRESH" backfill --root "$ROOT" >/dev/null 2>&1
cmp -s "$LOG" "$TMP/log-after-bf" && ok "idempotent backfill re-run logs nothing" \
                                  || notok "idempotent backfill re-run logs nothing"

# 7. an edge citing a frontmatter line is rejected (self-anchoring guard)
cat > "$TMP/attack.json" <<'EOF'
[{"from": "F-941", "kind": "relates_to", "target": "F-940", "line": 1,
  "evidence": "fabricated", "rationale": "attack"}]
EOF
out=$(python3 "$REFRESH" add-edges "$TMP/attack.json" --root "$ROOT" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'REJECTED.*frontmatter' \
   && ! grep -q 'kind: relates_to' "$ROOT/done/F-941-beta/index.md"; then
  ok "frontmatter-line edge rejected, nothing written"
else
  notok "frontmatter-line edge rejected, nothing written (rc=$rc out=$out)"
fi

# 8. wiring: analyze locate-step carries the write-back rule
sec=$(awk '/^#+ .*Prior [Cc]ontext/{p=1; next} p && /^#+ /{exit} p' "$REPO/plugins/ae/skills/analyze/SKILL.md")
case "$sec" in
  *"add-page"*) ok "analyze locate-step carries the write-back rule";;
  *) notok "analyze locate-step carries the write-back rule";;
esac

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
