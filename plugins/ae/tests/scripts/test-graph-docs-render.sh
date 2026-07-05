#!/bin/sh
# docs/ rendering is deterministic (AC14): running the generator twice on the
# same fixture corpus byte-diffs empty; stale pages render with their state
# marked; syn↔syn edges appear as typed mermaid arrows; components link back
# to their pages; empty corpus writes the explicit empty-state doc.
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

# --- 1. render + determinism: two runs, empty byte-diff
"$PY" "$SCRIPTS/graph-render-docs.py" --features-root "$ROOT" --synthesis-root "$SYN" --out "$TMP/a.md" >/dev/null 2>&1 \
  && ok "render succeeds" || notok "render succeeds"
"$PY" "$SCRIPTS/graph-render-docs.py" --features-root "$ROOT" --synthesis-root "$SYN" --out "$TMP/b.md" >/dev/null 2>&1
cmp -s "$TMP/a.md" "$TMP/b.md" && ok "byte-identical on re-run (deterministic)" || notok "byte-identical on re-run (deterministic)"

# --- 2. topology rendered: syn→syn typed arrow + component sections + page links
grep -q 'syn_alpha_arch -->|talks_to| syn_beta_arch' "$TMP/a.md" \
  && ok "syn→syn edge rendered as typed mermaid arrow" || notok "syn→syn edge rendered as typed mermaid arrow"
grep -q '### Alpha architecture' "$TMP/a.md" \
  && ok "component section present" || notok "component section present"
grep -q '](../.ae/graph/synthesis/syn-alpha-arch.md)' "$TMP/a.md" \
  && ok "component links back to its page" || notok "component links back to its page"
grep -q 'Documented for: F-901' "$TMP/a.md" \
  && ok "documented_by feature listed" || notok "documented_by feature listed"

# --- 3. stale page renders WITH its state marked
sed -i '' 's/^state: fresh$/state: stale/' "$SYN/syn-beta-arch.md" 2>/dev/null || sed -i 's/^state: fresh$/state: stale/' "$SYN/syn-beta-arch.md"
"$PY" "$SCRIPTS/graph-render-docs.py" --features-root "$ROOT" --synthesis-root "$SYN" --out "$TMP/c.md" >/dev/null 2>&1
grep -q 'Beta architecture \[stale\]' "$TMP/c.md" \
  && ok "stale page marked in the diagram" || notok "stale page marked in the diagram"
grep -q '— \*\*stale\*\*' "$TMP/c.md" \
  && ok "stale page marked in its component section" || notok "stale page marked in its component section"

# --- 3b. a double-quote in a free-text title must not break the mermaid label
#         (unterminated string = silent blank diagram, exit still 0)
cat > "$SYN/syn-quoted.md" <<'EOF'
---
id: syn-quoted
title: "The \"quoted\" component"
created: 2026-01-01
written_by: batch
state: fresh
anchors:
  - source: "features/active/F-902-beta/index.md:8"
    anchor_hash: "Beta is referenced by alpha."
---

Quoted title fixture (anchored at features/active/F-902-beta/index.md:8).
EOF
"$PY" "$SCRIPTS/graph-render-docs.py" --features-root "$ROOT" --synthesis-root "$SYN" --out "$TMP/q.md" >/dev/null 2>&1
grep -q 'syn_quoted\["The .quoted. component"\]' "$TMP/q.md" \
  && ok "double-quote in title escaped in the mermaid label" || notok "double-quote in title escaped in the mermaid label"
grep -q 'syn_quoted\["The "quoted" component"\]' "$TMP/q.md" \
  && notok "no raw double-quote inside the label" || ok "no raw double-quote inside the label"
rm -f "$SYN/syn-quoted.md"

# --- 4. empty corpus: explicit empty-state doc, still exit 0
mkdir -p "$TMP/empty/features/active" "$TMP/empty/syn"
"$PY" "$SCRIPTS/graph-render-docs.py" --features-root "$TMP/empty/features" --synthesis-root "$TMP/empty/syn" --out "$TMP/e.md" >/dev/null 2>&1 \
  && ok "empty corpus renders (exit 0)" || notok "empty corpus renders (exit 0)"
grep -q 'No synthesis pages exist yet' "$TMP/e.md" \
  && ok "empty-state doc is explicit" || notok "empty-state doc is explicit"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
