#!/bin/sh
# AC1+AC2 (F-071): graph-refresh.py deterministic half + live-run landmines locked
# + /ae:graph-refresh SKILL.md wiring. sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BOOT="$REPO/plugins/ae/scripts/graph-refresh.py"
LINT="$REPO/plugins/ae/scripts/graph-lint.py"
SKILL="$REPO/plugins/ae/skills/knowledge-refresh/SKILL.md"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# ---------- fixture tree ----------
mkdir -p "$tmp/t/done/F-970-parent" "$tmp/t/done/F-971-child" "$tmp/t/done/F-972-badref" "$tmp/t/backlog"
cat > "$tmp/t/done/F-970-parent/index.md" <<'EOF'
---
id: F-970
title: "Fixture — parent (target of depends_on)"
status: done
created: 2026-07-04
---

# F-970 — parent

Body mentions the sibling F-971 as a follow-up here.
EOF
cat > "$tmp/t/done/F-971-child/index.md" <<'EOF'
---
id: F-971
title: "Fixture — child with legacy fields"
status: done
created: 2026-07-04
origin_bl: BL-970
depends_on: [F-970]
---

# F-971 — child
EOF
echo "# BL-970 fixture" > "$tmp/t/done/F-971-child/BL-970.md"
# no-trailing-newline frontmatter (the corruption landmine) + unresolvable origin_bl
printf -- '---\nid: F-972\ntitle: "Fixture — no trailing newline + bad origin"\nstatus: done\ncreated: 2026-07-04\norigin_bl: BL-999\ndepends_on: [F-970]\n---' > "$tmp/t/done/F-972-badref/index.md"

# ---------- backfill: dry-run mutates nothing ----------
before=$(cat "$tmp/t/done/F-971-child/index.md")
out=$(python3 "$BOOT" backfill --root "$tmp/t" --dry-run 2>&1)
[ "$before" = "$(cat "$tmp/t/done/F-971-child/index.md")" ] && ok "dry-run mutates nothing" || notok "dry-run mutates nothing"
case "$out" in *F-971*) ok "dry-run previews the planned writes";; *) notok "dry-run previews the planned writes";; esac

# ---------- backfill: real run ----------
out=$(python3 "$BOOT" backfill --root "$tmp/t" 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "backfill exits 0" || notok "backfill exits 0 (got $rc)"
grep -q 'kind: origin' "$tmp/t/done/F-971-child/index.md" && ok "origin_bl converted to origin edge" || notok "origin_bl converted to origin edge"
grep -q 'kind: relates_to' "$tmp/t/done/F-971-child/index.md" && ok "depends_on converted to relates_to edge" || notok "depends_on converted to relates_to edge"
case "$out" in *BL-999*) ok "unresolvable origin_bl SKIPPED and listed";; *) notok "unresolvable origin_bl SKIPPED and listed";; esac
if grep -q 'id: BL-999' "$tmp/t/done/F-972-badref/index.md"; then  # edge form, not the legacy field itself
  notok "unresolvable target never written"
else
  ok "unresolvable target never written"
fi

# no-trailing-newline file survives append and still lint-parses (corruption landmine)
if python3 "$LINT" --root "$tmp/t" "$tmp/t/done/F-972-badref" >/dev/null 2>&1; then
  ok "no-trailing-newline frontmatter survives append (re-parses clean)"
else
  notok "no-trailing-newline frontmatter survives append (re-parses clean)"
fi
python3 "$LINT" --root "$tmp/t" "$tmp/t/done/F-971-child" >/dev/null 2>&1 && ok "touched node lint-clean" || notok "touched node lint-clean"

# anchor assertion: the written source: line number lands on the depends_on line
srcline=$(grep -o 'source: "index.md:[0-9]*"' "$tmp/t/done/F-971-child/index.md" | head -1 | grep -o '[0-9]*')
if [ -n "$srcline" ] && sed -n "${srcline}p" "$tmp/t/done/F-971-child/index.md" | grep -q 'depends_on'; then
  ok "backfill source line ANCHORS on the depends_on line post-write"
else
  notok "backfill source line ANCHORS on the depends_on line post-write (line $srcline)"
fi

# idempotence: second run writes zero
snap=$(cat "$tmp/t/done/F-971-child/index.md")
out=$(python3 "$BOOT" backfill --root "$tmp/t" 2>&1)
[ "$snap" = "$(cat "$tmp/t/done/F-971-child/index.md")" ] && ok "second backfill run writes zero (idempotent)" || notok "second backfill run writes zero (idempotent)"

# ---------- candidates ----------
out=$(python3 "$BOOT" candidates --root "$tmp/t" 2>&1)
case "$out" in
  *"F-970"*"F-971"*) ok "candidates finds the planted body mention (F-970 -> F-971)";;
  *) notok "candidates finds the planted body mention (F-970 -> F-971)";;
esac
# F-971 -> F-970 already has an edge (from backfill) → must be excluded
if printf '%s\n' "$out" | grep '^F-971' | grep -q 'F-970'; then
  notok "candidates excludes already-edged targets"
else
  ok "candidates excludes already-edged targets"
fi

# ---------- add-edges: good row writes with anchor verification ----------
lineno=$(grep -n 'follow-up here' "$tmp/t/done/F-970-parent/index.md" | cut -d: -f1)
cat > "$tmp/edges.json" <<EOF
[{"from": "F-970", "kind": "relates_to", "target": "F-971", "line": $lineno,
  "evidence": "body names F-971 as a follow-up", "rationale": "bootstrap fixture judgment"}]
EOF
out=$(python3 "$BOOT" add-edges "$tmp/edges.json" --root "$tmp/t" 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "add-edges exits 0 on a good row" || notok "add-edges exits 0 on a good row (got $rc)"
grep -q 'id: F-971' "$tmp/t/done/F-970-parent/index.md" && ok "judged edge written" || notok "judged edge written"
srcline=$(grep -o 'source: "index.md:[0-9]*"' "$tmp/t/done/F-970-parent/index.md" | head -1 | grep -o '[0-9]*')
if [ -n "$srcline" ] && sed -n "${srcline}p" "$tmp/t/done/F-970-parent/index.md" | grep -q 'F-971'; then
  ok "add-edges source line ANCHORS on the citing body line post-write"
else
  notok "add-edges source line ANCHORS on the citing body line post-write (line $srcline)"
fi

# ---------- add-edges: lint-failing row is REVERTED and reported ----------
snap=$(cat "$tmp/t/done/F-970-parent/index.md")
cat > "$tmp/bad.json" <<EOF
[{"from": "F-970", "kind": "relates_to", "target": "F-999", "line": $lineno,
  "evidence": "dangling target", "rationale": "must be reverted"}]
EOF
out=$(python3 "$BOOT" add-edges "$tmp/bad.json" --root "$tmp/t" 2>&1); rc=$?
[ "$rc" -ne 0 ] && ok "add-edges exits non-zero on a lint-failing row" || notok "add-edges exits non-zero on a lint-failing row"
[ "$snap" = "$(cat "$tmp/t/done/F-970-parent/index.md")" ] && ok "lint-failing write REVERTED (file unchanged)" || notok "lint-failing write REVERTED (file unchanged)"
case "$out" in *F-999*) ok "reverted row reported";; *) notok "reverted row reported";; esac

# ---------- AC2: SKILL.md wiring ----------
if [ -f "$SKILL" ]; then
  ok "graph-refresh SKILL.md exists"
  for token in "backfill" "candidates" "add-edges" "graph-lint.py" "graph-index-gen.py" "graph-neighbors.py"; do
    if grep -q -- "$token" "$SKILL"; then ok "SKILL wires $token"; else notok "SKILL wires $token"; fi
  done
  grep -qi 'never invent.*orphan\|orphans.*stay orphans\|never.*edges for.*orphan' "$SKILL" && \
    ok "never-invent-orphan-edges rule present" || notok "never-invent-orphan-edges rule present"
  grep -qi 'noise\|REJECT' "$SKILL" && ok "noise-rejection guidance present" || notok "noise-rejection guidance present"
else
  notok "graph-refresh SKILL.md exists"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
