#!/bin/sh
# AC2 (F-069 Step 2): graph-lint.py catches planted machine-verifiable edge defects,
# passes clean AND structurally-valid-but-semantically-dubious trees (form, not meaning).
# sh-tap output (parser: sh-tap.v1). Fixture trees are built at runtime in a tmpdir
# (collect-ac-evidence.py pattern); the two enum trees reuse Step 1's static fixtures.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LINT="$REPO/plugins/ae/scripts/graph-lint.py"
FIX="$HERE/../fixtures/graph"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# ---------- fixture tree: planted defects ----------
# F-999 decoys: a NESTED dir (Track 4) and a TOP-LEVEL dir WITHOUT index.md
# (codex challenge) both coincidentally named like the dangling target —
# resolution requires a top-level dir WITH index.md, so F-999 must STILL be
# named dangling despite both decoys.
mkdir -p "$tmp/lint-defects/done/F-908-connected/notes/F-999-decoy" \
         "$tmp/lint-defects/active/F-999-decoy" \
         "$tmp/lint-defects/done/F-909-target" \
         "$tmp/lint-defects/done/F-910-orphan"
cat > "$tmp/lint-defects/done/F-908-connected/index.md" <<'EOF'
---
id: F-908
title: "Fixture — connected node carrying every planted edge defect"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-999
    source: "index.md:3"
    evidence: "dangling target — F-999 does not exist in this tree"
    written_by: human
  - kind: relates_to
    id: F-909
    source: "missing-file.md:5"
    evidence: "bad source — file does not exist"
    written_by: human
  - kind: relates_to
    id: F-909
    source: "index.md:9999"
    evidence: "bad source — line beyond EOF"
    written_by: human
  - kind: relates_to
    id: banana
    source: "index.md:2"
    evidence: "malformed target id — not F-NNN/BL-NNN/disc-NNN"
    written_by: human
  - kind: relates_to
    id: F-909
    written_by: human
---

# Planted defects: dangling target, missing source file, line beyond EOF,
# malformed id, relates_to missing required source.
EOF
cat > "$tmp/lint-defects/done/F-909-target/index.md" <<'EOF'
---
id: F-909
title: "Fixture — referenced target (not an orphan)"
status: done
created: 2026-07-03
---

# Referenced by F-908 → participates in the graph, must NOT be an orphan.
EOF
cat > "$tmp/lint-defects/done/F-910-orphan/index.md" <<'EOF'
---
id: F-910
title: "Fixture — planted orphan (zero edges, never referenced)"
status: done
created: 2026-07-03
---

# No edges, never referenced → whole-tree mode must name F-910 as orphan.
EOF

# ---------- fixture tree: clean (F/BL/disc targets all resolve) ----------
mkdir -p "$tmp/lint-clean/done/F-904-alpha/discussions/901-sample" \
         "$tmp/lint-clean/done/F-905-beta"
cat > "$tmp/lint-clean/done/F-904-alpha/index.md" <<'EOF'
---
id: F-904
title: "Fixture — clean node (every target kind resolves)"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-905
    source: "index.md:2"
    evidence: "shares the sample-lineage theme with F-905"
    written_by: review-archive
    judge: {value: pass, rationale: "verified sibling"}
  - kind: origin
    id: BL-901
    written_by: human
  - kind: relates_to
    id: disc-901
    source: "index.md:3"
    evidence: "the design decision recorded in discussion 901 shaped this node"
    written_by: human
---

# F-NNN, BL-NNN and disc-NNN targets all resolve inside this tree → exit 0.
EOF
echo "# BL-901 — fixture backlog item" > "$tmp/lint-clean/done/F-904-alpha/BL-901.md"
printf -- '---\nid: "901"\ntitle: "Fixture discussion"\n---\n' \
  > "$tmp/lint-clean/done/F-904-alpha/discussions/901-sample/index.md"
cat > "$tmp/lint-clean/done/F-905-beta/index.md" <<'EOF'
---
id: F-905
title: "Fixture — referenced sibling"
status: done
created: 2026-07-03
---

# Target of F-904's relates_to edge; not an orphan.
EOF

# ---------- fixture tree: structurally-valid but semantically-dubious (AC2 4th) ----------
mkdir -p "$tmp/lint-dubious/done/F-906-parser" "$tmp/lint-dubious/done/F-907-unrelated"
cat > "$tmp/lint-dubious/done/F-906-parser/index.md" <<'EOF'
---
id: F-906
title: "Fixture — structurally-valid but semantically-dubious edge"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-907
    source: "index.md:2"
    evidence: "both titles contain the letter e"
    written_by: review-archive
    judge: {value: pass, rationale: "n/a"}
---

# Resolves, in-enum, source resolves — meaning is obviously bogus.
# graph-lint checks FORM not MEANING → must exit 0.
EOF
cat > "$tmp/lint-dubious/done/F-907-unrelated/index.md" <<'EOF'
---
id: F-907
title: "Fixture — unrelated sibling"
status: done
created: 2026-07-03
---

# Referenced by F-906's dubious edge → tree is structurally clean.
EOF

# ---------- fixture tree: malformed shapes (codex testgen hazards) ----------
mkdir -p "$tmp/lint-malformed/done/F-920-badyaml" \
         "$tmp/lint-malformed/done/F-921-scalar-edges" \
         "$tmp/lint-malformed/done/F-922-partial-edge" \
         "$tmp/lint-malformed/done/F-923-escape"
cat > "$tmp/lint-malformed/done/F-920-badyaml/index.md" <<'EOF'
---
id: F-920
title: "Fixture — invalid YAML frontmatter
status: done
created: 2026-07-03
---

# Unterminated quote above → unparseable frontmatter must be a NAMED defect,
# not a false-pass as "no edges" (codex).
EOF
cat > "$tmp/lint-malformed/done/F-921-scalar-edges/index.md" <<'EOF'
---
id: F-921
title: "Fixture — edges is a scalar, not a list"
status: done
created: 2026-07-03
edges: banana-not-a-list
---

# Non-list edges container must be a named defect (codex).
EOF
cat > "$tmp/lint-malformed/done/F-922-partial-edge/index.md" <<'EOF'
---
id: F-922
title: "Fixture — per-edge shape defects"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-921
    source: "index.md:2"
    evidence: "missing written_by — required field absent"
  - "F-921"
  - kind: [relates_to]
    id: F-921
    source: "index.md:2"
    evidence: "non-scalar kind must be a named defect, not a TypeError"
    written_by: human
---

# Edge 1 lacks required written_by; edge 2 is a bare string; edge 3 has a
# list-valued kind (codex Track 2: must not crash).
EOF
mkdir -p "$tmp/lint-malformed/done/F-926-null-edges"
cat > "$tmp/lint-malformed/done/F-926-null-edges/index.md" <<'EOF'
---
id: F-926
title: "Fixture — edges key present but null"
status: done
created: 2026-07-03
edges:
---

# `edges:` with a null value must be a named defect, not silently treated
# as absent (codex Track 2: scoped-mode false-pass hazard).
EOF
cat > "$tmp/lint-malformed/done/F-923-escape/index.md" <<'EOF'
---
id: F-923
title: "Fixture — source path escapes the node dir"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-921
    source: "../F-921-scalar-edges/index.md:1"
    evidence: "source resolves OUTSIDE this node's dir — provenance must be local"
    written_by: human
---

# Path escape must be a named defect (codex).
EOF

# ---------- fixture tree: duplicate node id across states ----------
mkdir -p "$tmp/lint-duplicate/done/F-924-first" \
         "$tmp/lint-duplicate/active/F-924-second" \
         "$tmp/lint-duplicate/done/F-925-target"
cat > "$tmp/lint-duplicate/done/F-924-first/index.md" <<'EOF'
---
id: F-924
title: "Fixture — duplicate node id (done copy)"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-925
    source: "index.md:2"
    evidence: "keeps the tree otherwise clean"
    written_by: human
---

# Same F-924 id also exists under active/ (e.g. failed archive mv).
EOF
cat > "$tmp/lint-duplicate/active/F-924-second/index.md" <<'EOF'
---
id: F-924
title: "Fixture — duplicate node id (active copy)"
status: active
created: 2026-07-03
---

# Second dir carrying id F-924.
EOF
cat > "$tmp/lint-duplicate/done/F-925-target/index.md" <<'EOF'
---
id: F-925
title: "Fixture — target keeping the duplicate tree otherwise clean"
status: done
created: 2026-07-03
---

# Referenced by F-924 → only defect in this tree is the duplicate id.
EOF

# ========== assertions ==========

# --- defects tree: whole-tree mode must fail AND name each planted defect ---
out=$(python3 "$LINT" --root "$tmp/lint-defects" 2>&1); rc=$?

if [ "$rc" -eq 1 ]; then
  ok "defects tree exits 1"
else
  notok "defects tree exits 1 (got $rc)"
fi

case "$out" in *F-999*) ok "names dangling target F-999";; *) notok "names dangling target F-999";; esac
case "$out" in *missing-file.md*) ok "names missing source file";; *) notok "names missing source file";; esac
case "$out" in *9999*) ok "names line-beyond-EOF source";; *) notok "names line-beyond-EOF source";; esac
case "$out" in *banana*) ok "names malformed target id";; *) notok "names malformed target id";; esac
case "$out" in *F-910*) ok "names orphan F-910";; *) notok "names orphan F-910";; esac
if printf '%s' "$out" | grep -i 'orphan' | grep -q 'F-909'; then
  notok "referenced F-909 not flagged as orphan"
else
  ok "referenced F-909 not flagged as orphan"
fi
case "$out" in *source*) ok "names relates_to missing required source";; *) notok "names relates_to missing required source";; esac

# --- clean tree: F-NNN + BL-NNN + disc-NNN targets all resolve → exit 0 ---
if python3 "$LINT" --root "$tmp/lint-clean" >/dev/null 2>&1; then
  ok "clean tree exits 0 (F/BL/disc targets resolve)"
else
  notok "clean tree exits 0 (F/BL/disc targets resolve)"
fi

# --- dubious tree (AC2 fourth fixture): valid form, meaningless meaning → exit 0 ---
if python3 "$LINT" --root "$tmp/lint-dubious" >/dev/null 2>&1; then
  ok "semantically-dubious but well-formed edge passes (form, not meaning)"
else
  notok "semantically-dubious but well-formed edge passes (form, not meaning)"
fi

# --- enum defects: reuse Step 1 static fixtures — graph-lint also enforces enums ---
if python3 "$LINT" --root "$FIX/invalid-kind" >/dev/null 2>&1; then
  notok "out-of-enum kind fails lint"
else
  ok "out-of-enum kind fails lint"
fi
if python3 "$LINT" --root "$FIX/invalid-writer" >/dev/null 2>&1; then
  notok "out-of-enum written_by fails lint"
else
  ok "out-of-enum written_by fails lint"
fi

# --- scoped mode (Step 4 gate shape): lint ONE node's edges, no whole-graph checks ---
if python3 "$LINT" --root "$tmp/lint-defects" "$tmp/lint-defects/done/F-909-target" >/dev/null 2>&1; then
  ok "scoped mode on clean node exits 0 despite tree-wide defects"
else
  notok "scoped mode on clean node exits 0 despite tree-wide defects"
fi
if python3 "$LINT" --root "$tmp/lint-defects" "$tmp/lint-defects/done/F-908-connected" >/dev/null 2>&1; then
  notok "scoped mode on defective node exits 1"
else
  ok "scoped mode on defective node exits 1"
fi

# --- codex testgen: malformed-shape hazards must be NAMED defects, not silent skips ---
out=$(python3 "$LINT" --root "$tmp/lint-malformed" 2>&1); rc=$?
if [ "$rc" -eq 1 ]; then
  ok "malformed tree exits 1"
else
  notok "malformed tree exits 1 (got $rc)"
fi
case "$out" in *F-920*) ok "names unparseable YAML frontmatter (F-920)";; *) notok "names unparseable YAML frontmatter (F-920)";; esac
case "$out" in *F-921*) ok "names non-list edges container (F-921)";; *) notok "names non-list edges container (F-921)";; esac
case "$out" in *written_by*) ok "names edge missing required written_by";; *) notok "names edge missing required written_by";; esac
case "$out" in *F-922*) ok "names non-mapping edge entry (F-922)";; *) notok "names non-mapping edge entry (F-922)";; esac
case "$out" in *F-923*) ok "names source path escaping the node dir (F-923)";; *) notok "names source path escaping the node dir (F-923)";; esac
case "$out" in *Traceback*) notok "non-scalar kind is a named defect, not a crash";; *"kind '['"*|*"kind '[relates_to]'"*) ok "non-scalar kind is a named defect, not a crash";; *) notok "non-scalar kind is a named defect, not a crash";; esac
case "$out" in *F-926*) ok "names edges-present-but-null (F-926)";; *) notok "names edges-present-but-null (F-926)";; esac

# --- codex testgen: duplicate node id = nondeterministic resolution = defect ---
out=$(python3 "$LINT" --root "$tmp/lint-duplicate" 2>&1); rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q 'F-924'; then
  ok "duplicate node id F-924 across states is a named defect"
else
  notok "duplicate node id F-924 across states is a named defect (rc=$rc)"
fi
if printf '%s' "$out" | grep -i 'orphan' | grep -q 'F-924'; then
  notok "duplicate id with edges not ALSO flagged as orphan (orphan is per-id)"
else
  ok "duplicate id with edges not ALSO flagged as orphan (orphan is per-id)"
fi

# --- review P1: closing --- without trailing newline parses like index-gen ---
mkdir -p "$tmp/lint-noeol/done/F-927-noeol" "$tmp/lint-noeol/done/F-928-target"
printf -- '---\nid: F-927\ntitle: "Fixture — no trailing newline"\nstatus: done\ncreated: 2026-07-03\nedges:\n  - kind: relates_to\n    id: F-928\n    source: "index.md:1"\n    evidence: "regex-parity fixture"\n    written_by: human\n---' > "$tmp/lint-noeol/done/F-927-noeol/index.md"
printf -- '---\nid: F-928\ntitle: "Fixture — target"\nstatus: done\ncreated: 2026-07-03\n---\n' > "$tmp/lint-noeol/done/F-928-target/index.md"
if python3 "$LINT" --root "$tmp/lint-noeol" >/dev/null 2>&1; then
  ok "file with no trailing newline after closing --- parses (regex parity with index-gen)"
else
  notok "file with no trailing newline after closing --- parses (regex parity with index-gen)"
fi

# --- usage errors → exit 2 ---
python3 "$LINT" --root "$tmp/no-such-tree" >/dev/null 2>&1
[ $? -eq 2 ] && ok "nonexistent root exits 2 (usage)" || notok "nonexistent root exits 2 (usage)"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
