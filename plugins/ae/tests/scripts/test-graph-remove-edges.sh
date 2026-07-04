#!/bin/sh
# remove-edges: the only machine delete path for edges — removes by
# (from, kind, target), REFUSES human-written rows, no-ops on missing rows,
# scoped-lints after removal, logs only real removals.
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
ROOT="$TMP/.ae/features"
mkdir -p "$ROOT/done/F-950-a" "$ROOT/done/F-951-b" "$TMP/.ae/backlog"
: > "$TMP/.ae/backlog/BL-950-seed.md"
cat > "$ROOT/done/F-950-a/index.md" <<'EOF'
---
id: F-950
title: "a"
status: done
created: 2026-07-04
edges:
  - kind: origin
    id: BL-950
    written_by: human
  - kind: relates_to
    id: F-951
    source: "index.md:14"
    evidence: "batch-judged link"
    written_by: batch
    judge: {value: pass, rationale: "test"}
---
Body.
F-951 mentioned here.
EOF
cat > "$ROOT/done/F-951-b/index.md" <<'EOF'
---
id: F-951
title: "b"
status: done
created: 2026-07-04
edges:
  - kind: origin
    id: BL-950
    written_by: human
---
Body b.
EOF
LOG="$TMP/.ae/graph/log.md"

# 1. removes a batch edge; other edges survive; logged once
cat > "$TMP/rm1.json" <<'EOF'
[{"from": "F-950", "kind": "relates_to", "target": "F-951"}]
EOF
out=$(python3 "$REFRESH" remove-edges "$TMP/rm1.json" --root "$ROOT" 2>&1); rc=$?
if [ $rc -eq 0 ] && ! grep -q 'kind: relates_to' "$ROOT/done/F-950-a/index.md" \
   && grep -q 'kind: origin' "$ROOT/done/F-950-a/index.md" \
   && [ "$(grep -c 'remove-edges' "$LOG")" = "1" ]; then
  ok "batch edge removed, sibling human edge survives, one log record"
else
  notok "batch edge removed, sibling human edge survives, one log record (rc=$rc out=$out)"
fi

# 2. human-written edge: REFUSED, file untouched, nothing logged
cat > "$TMP/rm2.json" <<'EOF'
[{"from": "F-950", "kind": "origin", "target": "BL-950"}]
EOF
before=$(cat "$ROOT/done/F-950-a/index.md")
out=$(python3 "$REFRESH" remove-edges "$TMP/rm2.json" --root "$ROOT" 2>&1); rc=$?
after=$(cat "$ROOT/done/F-950-a/index.md")
if [ $rc -ne 0 ] && printf '%s' "$out" | grep -q 'REFUSED' && [ "$before" = "$after" ] \
   && [ "$(grep -c 'remove-edges' "$LOG")" = "1" ]; then
  ok "human edge refused, file + log untouched"
else
  notok "human edge refused, file + log untouched (rc=$rc out=$out)"
fi

# 3. missing row: no-op, exit 0
out=$(python3 "$REFRESH" remove-edges "$TMP/rm1.json" --root "$ROOT" 2>&1); rc=$?
if [ $rc -eq 0 ] && printf '%s' "$out" | grep -q 'no-op'; then
  ok "already-removed row: reported no-op, exit 0"
else
  notok "already-removed row: reported no-op, exit 0 (rc=$rc out=$out)"
fi

# 4. post-removal frontmatter still parses (scoped lint ran clean)
python3 - "$ROOT/done/F-950-a/index.md" <<'PYEOF'
import sys, re, yaml
t = open(sys.argv[1]).read()
m = re.match(r"^---\n(.*?)\n---\n?", t, re.S)
d = yaml.safe_load(m.group(1))
assert isinstance(d["edges"], list) and len(d["edges"]) == 1
assert d["edges"][0]["written_by"] == "human"
PYEOF
[ $? -eq 0 ] && ok "post-removal frontmatter parses; exactly the human edge remains" \
             || notok "post-removal frontmatter parses; exactly the human edge remains"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
