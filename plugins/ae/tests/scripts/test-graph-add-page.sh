#!/bin/sh
# add-page: the only machine write path for synthesis pages — atomic write,
# idempotent by id, refuses divergent re-add, deletes on check failure,
# logs only successful mutations.
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REFRESH="$REPO/plugins/ae/scripts/graph-refresh.py"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAKE="$TMP/repo"
mkdir -p "$FAKE/src"
printf 'the anchored line\n' > "$FAKE/src/a.txt"
git -C "$FAKE" init -q && git -C "$FAKE" add -A
git -C "$FAKE" -c user.email=t@t -c user.name=t commit -qm seed
SYN="$FAKE/.ae/graph/synthesis"
LOG="$FAKE/.ae/graph/log.md"

goodjson="$TMP/good.json"
cat > "$goodjson" <<'EOF'
{"id": "syn-alpha", "title": "alpha component",
 "anchors": [{"source": "src/a.txt:1", "anchor_hash": "the anchored line"}],
 "body": "The alpha component owns the anchored behavior (src/a.txt:1)."}
EOF

# 1. happy path: page written, check passes, one log record
out=$(python3 "$REFRESH" add-page "$goodjson" --synthesis-root "$SYN" 2>&1); rc=$?
if [ $rc -eq 0 ] && [ -f "$SYN/syn-alpha.md" ] && [ "$(grep -c 'add-page: syn-alpha' "$LOG")" = "1" ]; then
  ok "happy path: page written + exactly one log record"
else
  notok "happy path: page written + exactly one log record (rc=$rc out=$out)"
fi

# 2. identical re-add: no-op, no second log record
out=$(python3 "$REFRESH" add-page "$goodjson" --synthesis-root "$SYN" 2>&1); rc=$?
if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'no-op' && [ "$(grep -c 'add-page: syn-alpha' "$LOG")" = "1" ]; then
  ok "identical re-add: no-op, log untouched"
else
  notok "identical re-add: no-op, log untouched (rc=$rc out=$out)"
fi

# 3. same id, different content: refused, file untouched, no log record
divjson="$TMP/div.json"
sed 's/owns the anchored behavior/claims something else about/' "$goodjson" > "$divjson"
before=$(cat "$SYN/syn-alpha.md")
out=$(python3 "$REFRESH" add-page "$divjson" --synthesis-root "$SYN" 2>&1); rc=$?
after=$(cat "$SYN/syn-alpha.md")
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'REFUSED' && [ "$before" = "$after" ] \
   && [ "$(grep -c 'add-page: syn-alpha' "$LOG")" = "1" ]; then
  ok "divergent re-add: refused, file + log untouched"
else
  notok "divergent re-add: refused, file + log untouched (rc=$rc)"
fi

# 4. uncited anchor: refused before any write
uncitjson="$TMP/uncit.json"
cat > "$uncitjson" <<'EOF'
{"id": "syn-uncited", "title": "uncited",
 "anchors": [{"source": "src/a.txt:1", "anchor_hash": "the anchored line"}],
 "body": "Body that never cites its anchor."}
EOF
out=$(python3 "$REFRESH" add-page "$uncitjson" --synthesis-root "$SYN" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'not cited' && [ ! -f "$SYN/syn-uncited.md" ]; then
  ok "uncited anchor: refused, no file"
else
  notok "uncited anchor: refused, no file (rc=$rc out=$out)"
fi

# 5. check failure (dead anchor path): file deleted, nothing logged
badjson="$TMP/bad.json"
cat > "$badjson" <<'EOF'
{"id": "syn-bad", "title": "bad anchors",
 "anchors": [{"source": "src/missing.txt:1", "anchor_hash": "x"}],
 "body": "Cites a dead path (src/missing.txt:1)."}
EOF
out=$(python3 "$REFRESH" add-page "$badjson" --synthesis-root "$SYN" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'REVERTED' && [ ! -f "$SYN/syn-bad.md" ] \
   && ! grep -q 'syn-bad' "$LOG"; then
  ok "check failure: file deleted, log untouched"
else
  notok "check failure: file deleted, log untouched (rc=$rc out=$out)"
fi

# 6. wrong anchor_hash at write time: page refused as not-fresh, no file, no log
cat > "$TMP/stalewrite.json" <<'EOF'
{"id": "syn-stalewrite", "title": "hash already wrong",
 "anchors": [{"source": "src/a.txt:1", "anchor_hash": "text that never matched"}],
 "body": "Cites (src/a.txt:1)."}
EOF
out=$(python3 "$REFRESH" add-page "$TMP/stalewrite.json" --synthesis-root "$SYN" 2>&1); rc=$?
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'not fresh' && [ ! -f "$SYN/syn-stalewrite.md" ] \
   && ! grep -q 'syn-stalewrite' "$LOG"; then
  ok "stale-at-write page refused, no file, no log"
else
  notok "stale-at-write page refused, no file, no log (rc=$rc out=$out)"
fi

# 7. malformed json: usage error exit 2
printf 'not json' > "$TMP/nj.json"
python3 "$REFRESH" add-page "$TMP/nj.json" --synthesis-root "$SYN" >/dev/null 2>&1
[ $? -eq 2 ] && ok "malformed json: exit 2 (usage)" || notok "malformed json: exit 2 (usage)"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
