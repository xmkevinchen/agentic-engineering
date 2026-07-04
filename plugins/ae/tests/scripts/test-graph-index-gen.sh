#!/bin/sh
# AC3 (F-069 Step 3): graph-index-gen.py — deterministic layered index, no narration.
# sh-tap output (parser: sh-tap.v1). Fixture tree built at runtime in mktemp.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GEN="$REPO/plugins/ae/scripts/graph-index-gen.py"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# ---------- fixture: 5 features, 2 normal themes + sentence theme + unthemed ----------
mkdir -p "$tmp/features/done/F-930-alpha-one" "$tmp/features/done/F-931-alpha-two" \
         "$tmp/features/active/F-932-beta-one" "$tmp/features/active/F-933-sentence" \
         "$tmp/features/paused/F-934-unthemed" "$tmp/features/done/F-935-broken"
cat > "$tmp/features/done/F-930-alpha-one/index.md" <<'EOF'
---
id: F-930
title: "Fixture alpha one"
status: done
created: 2026-07-03
theme: alpha-theme
---

# F-930 — alpha one

The alpha-one goal sentence used verbatim as the TL;DR row.
EOF
cat > "$tmp/features/done/F-931-alpha-two/index.md" <<'EOF'
---
id: F-931
title: "Fixture alpha two"
status: done
created: 2026-07-03
theme: alpha-theme
---

# F-931 — alpha two

Second alpha member with a multi-line TL;DR paragraph | pipe included
and this second line must survive byte-verbatim, not line-joined.
EOF
# F-1000 in beta-theme: numeric member sort — lexicographic would put F-1000
# before F-932; TL;DR starts with "#1" which is prose, not a heading
mkdir -p "$tmp/features/active/F-1000-gamma"
cat > "$tmp/features/active/F-1000-gamma/index.md" <<'EOF'
---
id: F-1000
title: "Fixture four digits"
status: active
created: 2026-07-03
theme: beta-theme
---

# F-1000 — gamma

#1 priority prose paragraph that starts with a hash but is not a heading.
EOF
# theme: 0 — falsy-but-real YAML value must keep its own bucket
mkdir -p "$tmp/features/active/F-936-zero-theme"
cat > "$tmp/features/active/F-936-zero-theme/index.md" <<'EOF'
---
id: F-936
title: "Fixture falsy theme"
status: active
created: 2026-07-03
theme: 0
---

# F-936 — zero theme

Falsy-but-real theme value keeps its own bucket.
EOF
# nested decoy: a non-node index.md deep inside a real feature dir
mkdir -p "$tmp/features/done/F-930-alpha-one/notes/F-998-decoy"
cat > "$tmp/features/done/F-930-alpha-one/notes/F-998-decoy/index.md" <<'EOF'
---
id: F-998
title: "Nested decoy — must NOT be indexed"
status: done
created: 2026-07-03
theme: alpha-theme
---

# decoy
EOF
cat > "$tmp/features/active/F-932-beta-one/index.md" <<'EOF'
---
id: F-932
title: "Fixture beta one"
status: active
created: 2026-07-03
theme: beta-theme
---

# F-932 — beta one

Beta member with its own verbatim summary line.
EOF
cat > "$tmp/features/active/F-933-sentence/index.md" <<'EOF'
---
id: F-933
title: "Fixture sentence-shaped theme"
status: active
created: 2026-07-03
theme: this theme is a whole sentence, not a tag
---

# F-933 — sentence theme

Sentence-theme member (F-040 hygiene hazard inside fixture coverage).
EOF
cat > "$tmp/features/paused/F-934-unthemed/index.md" <<'EOF'
---
id: F-934
title: "Fixture without a theme"
status: paused
created: 2026-07-03
---

# F-934 — unthemed

Missing theme must land in the uniform (unthemed) bucket, never invented.
EOF
cat > "$tmp/features/done/F-935-broken/index.md" <<'EOF'
---
title: "Fixture missing required id"
status: done
created: 2026-07-03
theme: alpha-theme
---

# F-935 — broken

Missing required id → reader contract: log error, skip record, keep scanning.
EOF

run(){ python3 "$GEN" --root "$tmp/features" --out "$tmp/wiki" 2>"$tmp/stderr.txt"; }

# ---------- Tier A: theme directory ----------
if run; then ok "index-gen exits 0"; else notok "index-gen exits 0"; fi
tierA="$tmp/wiki/index.md"
[ -f "$tierA" ] && ok "Tier A index.md written" || notok "Tier A index.md written"
out=$(cat "$tierA" 2>/dev/null)
case "$out" in *alpha-theme*) ok "Tier A lists alpha-theme";; *) notok "Tier A lists alpha-theme";; esac
case "$out" in *beta-theme*) ok "Tier A lists beta-theme";; *) notok "Tier A lists beta-theme";; esac
case "$out" in *"this theme is a whole sentence, not a tag"*) ok "sentence-shaped theme surfaced AS-IS (one bucket, not split)";; *) notok "sentence-shaped theme surfaced AS-IS (one bucket, not split)";; esac
case "$out" in *"(unthemed)"*) ok "missing theme lands in the exact (unthemed) bucket";; *) notok "missing theme lands in the exact (unthemed) bucket";; esac
# layered, never flat: member detail (TL;DR text) must NOT be in Tier A
case "$out" in *"verbatim as the TL;DR row"*) notok "Tier A stays layered (no member TL;DR rows)";; *) ok "Tier A stays layered (no member TL;DR rows)";; esac

# ---------- Tier B: per-theme member rows, verbatim fields ----------
alphaB=$(cat "$tmp/wiki/themes/"*alpha-theme*.md 2>/dev/null)
case "$alphaB" in *F-930*) ok "Tier B alpha lists F-930";; *) notok "Tier B alpha lists F-930";; esac
case "$alphaB" in *F-931*) ok "Tier B alpha lists F-931";; *) notok "Tier B alpha lists F-931";; esac
case "$alphaB" in *"Fixture alpha one"*) ok "title verbatim";; *) notok "title verbatim";; esac
case "$alphaB" in *done*) ok "status verbatim";; *) notok "status verbatim";; esac
case "$alphaB" in *"The alpha-one goal sentence used verbatim as the TL;DR row."*) ok "TL;DR = first body paragraph, verbatim";; *) notok "TL;DR = first body paragraph, verbatim";; esac
case "$alphaB" in *"multi-line TL;DR paragraph | pipe included
and this second line must survive byte-verbatim, not line-joined."*) ok "multi-line TL;DR with pipe preserved byte-verbatim";; *) notok "multi-line TL;DR with pipe preserved byte-verbatim";; esac
case "$alphaB" in *F-932*) notok "beta member not leaked into alpha theme";; *) ok "beta member not leaked into alpha theme";; esac
case "$alphaB" in *F-998*) notok "nested decoy index.md not indexed";; *) ok "nested decoy index.md not indexed";; esac

# ---------- deterministic ordering: sorted themes, (unthemed) last ----------
first=$(grep -nE 'alpha-theme' "$tierA" | head -1 | cut -d: -f1)
second=$(grep -nE 'beta-theme' "$tierA" | head -1 | cut -d: -f1)
last=$(grep -nF '(unthemed)' "$tierA" | head -1 | cut -d: -f1)
if [ -n "$first" ] && [ -n "$second" ] && [ -n "$last" ] && [ "$first" -lt "$second" ] && [ "$second" -lt "$last" ]; then
  ok "themes sorted alphabetically, (unthemed) last"
else
  notok "themes sorted alphabetically, (unthemed) last"
fi

# ---------- gemini/codex fixes: numeric sort, prose-#, falsy theme ----------
betaB=$(cat "$tmp/wiki/themes/"*beta-theme*.md 2>/dev/null)
f932=$(printf '%s\n' "$betaB" | grep -n 'F-932' | head -1 | cut -d: -f1)
f1000=$(printf '%s\n' "$betaB" | grep -n 'F-1000' | head -1 | cut -d: -f1)
if [ -n "$f932" ] && [ -n "$f1000" ] && [ "$f932" -lt "$f1000" ]; then
  ok "members sorted numerically (F-932 before F-1000)"
else
  notok "members sorted numerically (F-932 before F-1000)"
fi
case "$betaB" in *"#1 priority prose paragraph"*) ok "TL;DR starting with '#1' kept (prose, not heading)";; *) notok "TL;DR starting with '#1' kept (prose, not heading)";; esac
zeroB=$(cat "$tmp/wiki/themes/0.md" 2>/dev/null)
case "$zeroB" in *F-936*) ok "falsy-but-real theme 0 keeps its own bucket";; *) notok "falsy-but-real theme 0 keeps its own bucket";; esac

# ---------- reader contract: broken record skipped, scan continues ----------
case "$alphaB" in *"Fixture missing required id"*) notok "record missing required id is skipped";; *) ok "record missing required id is skipped";; esac
grep -q 'F-935\|missing required' "$tmp/stderr.txt" && ok "skip logged to stderr" || notok "skip logged to stderr"

# ---------- doodlestein: stale-reap only touches GENERATED files ----------
echo "user note, no marker" > "$tmp/wiki/themes/hand-authored.md"
printf '# Theme: ghost\n\nGenerated by graph-index-gen.py — do not edit.\n' > "$tmp/wiki/themes/ghost-theme.md"
run
[ -f "$tmp/wiki/themes/hand-authored.md" ] && ok "hand-authored file in themes/ survives regen" || notok "hand-authored file in themes/ survives regen"
[ ! -f "$tmp/wiki/themes/ghost-theme.md" ] && ok "stale GENERATED theme file reaped" || notok "stale GENERATED theme file reaped"
rm -f "$tmp/wiki/themes/hand-authored.md"
grep -q "do not edit" "$tmp/wiki/themes/"*alpha-theme*.md && ok "Tier B carries generated-file header" || notok "Tier B carries generated-file header"

# ---------- idempotent: second run produces identical bytes ----------
cp -R "$tmp/wiki" "$tmp/wiki-first"
run
if diff -r "$tmp/wiki-first" "$tmp/wiki" >/dev/null 2>&1; then
  ok "idempotent (same bytes on re-run)"
else
  notok "idempotent (same bytes on re-run)"
fi

# ---------- synthesis tier ----------
# no synthesis dir: tier omitted, output stays as-is
run
cp "$tmp/wiki/index.md" "$tmp/index-before-syn.md"
if ! grep -q "Synthesis pages" "$tmp/wiki/index.md"; then
  ok "no synthesis dir: tier omitted"
else
  notok "no synthesis dir: tier omitted"
fi
# with pages: one line per page, state label verbatim from page frontmatter
syn="$tmp/graph/synthesis"
mkdir -p "$syn"
cat > "$syn/syn-sample.md" <<'EOF'
---
id: syn-sample
title: "sample architecture page"
created: 2026-07-04
written_by: batch
state: stale
anchors:
  - source: "src/x.txt:1"
    anchor_hash: "x"
---
Body.
EOF
python3 "$GEN" --root "$tmp/features" --out "$tmp/wiki" --synthesis-root "$syn" >/dev/null 2>&1
if grep -q '^- syn-sample — sample architecture page (stale)$' "$tmp/wiki/index.md"; then
  ok "synthesis tier renders page line with stale label"
else
  notok "synthesis tier renders page line with stale label"
fi
# the default rule derives <root>/../graph/synthesis, so the tier also renders
# without the explicit flag on this layout
run
grep -q "Synthesis pages" "$tmp/wiki/index.md" \
  && ok "default synthesis-root derivation finds the sibling dir" \
  || notok "default synthesis-root derivation finds the sibling dir"
# removing the dir restores the tier-free output byte-identically
rm -rf "$tmp/graph"
run
if diff "$tmp/index-before-syn.md" "$tmp/wiki/index.md" >/dev/null 2>&1; then
  ok "regen after synthesis dir removal byte-identical to pre-tier output"
else
  notok "regen after synthesis dir removal byte-identical to pre-tier output"
fi

# ---------- usage ----------
python3 "$GEN" --root "$tmp/no-such" --out "$tmp/wiki2" >/dev/null 2>&1
[ $? -eq 2 ] && ok "nonexistent root exits 2 (usage)" || notok "nonexistent root exits 2 (usage)"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
