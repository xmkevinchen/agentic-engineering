#!/bin/sh
# Mechanical lint classes over the page network (F-076): a page participating
# in zero edges is an ORPHAN-PAGE (observation class — fails the whole-tree
# gate like feature orphans); an index overview lagging the pages is DRIFT
# (informational like STALE — never changes exit); detection never mutates:
# lint is read-only, and a supersedes proposal reaches the corpus only through
# the judged add-edges path (tagged with its proposal source).
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPTS="$REPO/plugins/ae/scripts"
FIX="$REPO/plugins/ae/tests/fixtures/graph-topology"
PY="${PYTHON:-python3}"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$FIX" "$TMP/tree"
ROOT="$TMP/tree/features"
SYN="$TMP/tree/graph/synthesis"

# --- 1. planted unlinked page → ORPHAN-PAGE line; linked pages NOT flagged
out="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
case "$out" in *"ORPHAN-PAGE: syn-orphan"*) ok "unlinked page flagged ORPHAN-PAGE";; *) notok "unlinked page flagged ORPHAN-PAGE";; esac
case "$out" in *"ORPHAN-PAGE: syn-alpha-arch"*) notok "edge-bearing page not an orphan";; *) ok "edge-bearing page not an orphan";; esac
case "$out" in *"ORPHAN-PAGE: syn-beta-arch"*) notok "inbound-only page not an orphan";; *) ok "inbound-only page not an orphan";; esac

# --- 2. lint is READ-ONLY: detection never mutates the corpus
sum_before="$(find "$TMP/tree" -type f -name '*.md' -exec cat {} + | cksum)"
"$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" >/dev/null 2>&1
sum_after="$(find "$TMP/tree" -type f -name '*.md' -exec cat {} + | cksum)"
[ "$sum_before" = "$sum_after" ] && ok "lint run leaves the corpus byte-identical" || notok "lint run leaves the corpus byte-identical"

# --- 3. DRIFT: index generated, then a page's state flips → state-mismatch line;
#        a page added after generation → missing-from-tier line; exit UNCHANGED
"$PY" "$SCRIPTS/graph-index-gen.py" --root "$ROOT" --out "$TMP/tree/graph" --synthesis-root "$SYN" >/dev/null 2>&1
out3a="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
case "$out3a" in *"DRIFT:"*) notok "fresh index: no drift lines";; *) ok "fresh index: no drift lines";; esac

sed -i '' 's/^state: fresh$/state: stale/' "$SYN/syn-orphan.md" 2>/dev/null || sed -i 's/^state: fresh$/state: stale/' "$SYN/syn-orphan.md"
out3b="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
case "$out3b" in *"DRIFT: syn-orphan: index shows 'fresh', frontmatter says 'stale'"*) ok "state flip → DRIFT state-mismatch line";; *) notok "state flip → DRIFT state-mismatch line ($out3b)";; esac

cat > "$SYN/syn-late.md" <<'EOF'
---
id: syn-late
title: "Added after index generation"
created: 2026-01-01
written_by: batch
state: fresh
anchors:
  - source: "features/active/F-902-beta/index.md:8"
    anchor_hash: "Beta is referenced by alpha."
---

Late page (anchored at features/active/F-902-beta/index.md:8).
EOF
out3c="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
case "$out3c" in *"DRIFT: syn-late: missing from the index Synthesis tier"*) ok "late page → DRIFT missing-from-tier line";; *) notok "late page → DRIFT missing-from-tier line";; esac

# exit semantics: drift alone never fails — remove every orphan+defect source
# (incl. syn-late, itself an orphan) and flip a LINKED page's state instead
rm "$SYN/syn-orphan.md" "$SYN/syn-gamma-bad.md" "$SYN/syn-late.md" \
   "$TMP/tree/features/active/F-903-gamma/index.md"
rmdir "$TMP/tree/features/active/F-903-gamma"
"$PY" "$SCRIPTS/graph-index-gen.py" --root "$ROOT" --out "$TMP/tree/graph" --synthesis-root "$SYN" >/dev/null 2>&1
sed -i '' 's/^state: fresh$/state: stale/' "$SYN/syn-beta-arch.md" 2>/dev/null || sed -i 's/^state: fresh$/state: stale/' "$SYN/syn-beta-arch.md"
out3d="$("$PY" "$SCRIPTS/graph-lint.py" --root "$ROOT" --synthesis-root "$SYN" --repo-root "$TMP/tree" 2>&1)"
rc3d=$?
case "$out3d" in *"DRIFT: syn-beta-arch"*) ok "drift present in the drift-only tree";; *) notok "drift present in the drift-only tree ($out3d)";; esac
[ $rc3d -eq 0 ] && ok "DRIFT alone never changes exit (informational like STALE)" || notok "DRIFT alone never changes exit (rc=$rc3d out=$out3d)"

# --- 4. proposal path: add-edges accepts a proposal_source tag and records it
#        in the mutation log (the write-point-health per-source breakdown input);
#        the proposal reaches the corpus ONLY through this judged path
cat > "$TMP/prop.json" <<'JSON'
[{"from": "F-901", "kind": "supersedes", "target": "F-902", "line": 20,
  "evidence": "lint-detected contradiction proposal", "rationale": "judged fixture",
  "proposal_source": "lint"}]
JSON
out4="$("$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/prop.json" --root "$ROOT" --repo-root "$TMP/tree" 2>&1)"
rc4=$?
[ $rc4 -eq 0 ] && ok "lint-sourced proposal lands through the judged path" || notok "lint-sourced proposal lands through the judged path ($out4)"
grep -q 'add-edges: F-901: 1 edge(s) \[lint\]' "$TMP/tree/graph/log.md" 2>/dev/null \
  && ok "mutation log carries the proposal source tag" || notok "mutation log carries the proposal source tag"

# --- 5. judged lint classes wired in knowledge-refresh (SKILL wiring floor;
#        semantic quality is the review judge's job, not grep's)
KR="$REPO/plugins/ae/skills/knowledge-refresh/SKILL.md"
grep -q 'Incremental' "$KR" && grep -q 'never all-pairs' "$KR" \
  && ok "refresh: incremental-only schedule stated" || notok "refresh: incremental-only schedule stated"
grep -q 'Missing pages' "$KR" && grep -q 'Missing cross-references' "$KR" \
  && ok "refresh: missing-pages + missing-xrefs classes present" || notok "refresh: missing-pages + missing-xrefs classes present"
grep -q 'Superseded claims' "$KR" && grep -q 'Contradictions' "$KR" \
  && ok "refresh: contradiction + superseded classes present" || notok "refresh: contradiction + superseded classes present"
grep -q '"proposal_source": "lint"' "$KR" \
  && ok "refresh: proposals tagged with their source" || notok "refresh: proposals tagged with their source"
grep -q 'Nothing is auto-written' "$KR" \
  && ok "refresh: detection feeds the judged path, never writes" || notok "refresh: detection feeds the judged path, never writes"
grep -q 'lint SUGGESTS missing structure' "$KR" \
  && ok "refresh: proactive-suggestion clause present" || notok "refresh: proactive-suggestion clause present"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
