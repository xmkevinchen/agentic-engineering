#!/bin/sh
# AC4a (F-069 Step 4): archive writes lint-clean edges at the right trigger + prose is wired.
# sh-tap output (parser: sh-tap.v1).
#
# HONESTY SCOPE (plan Design note 3): part 1 is a DETERMINISTIC LOGIC SIM of the
# archive trigger's control flow (loop-skip → edge-write → graph-lint gate → mv);
# it does NOT invoke the live /ae:review skill (no headless-skill harness exists
# in-repo). Part 2 is the companion STRUCTURAL WIRING GREP (F-067 lesson):
# asserts review/SKILL.md prose actually invokes graph-lint.py + the edge-write
# inside the archive-trigger region, not near Check 7. The LLM-behavioral half
# (are the edges REAL siblings?) is AC4b's judge rubric, not this test.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LINT="$REPO/plugins/ae/scripts/graph-lint.py"
SKILL="$REPO/plugins/ae/skills/review/SKILL.md"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# ---------- fixture tree: a finishing feature + a genuine sibling ----------
make_tree(){ # $1 = tree root
  mkdir -p "$1/active/F-940-finisher" "$1/done/F-941-sibling"
  cat > "$1/active/F-940-finisher/index.md" <<'EOF'
---
id: F-940
title: "Fixture — finishing feature"
status: active
created: 2026-07-03
---

# F-940 — finisher

Shares the sample-lineage mechanism with F-941.
EOF
  cat > "$1/done/F-941-sibling/index.md" <<'EOF'
---
id: F-941
title: "Fixture — genuine sibling"
status: done
created: 2026-07-03
---

# F-941 — sibling
EOF
}

# Deterministic logic sim of the Phase 1.5 control flow (review/SKILL.md):
# per-iteration loop-mode SKIPS the whole trigger; otherwise write edges (the
# test plants what the LLM would write), run the scoped graph-lint gate, and
# only on exit 0 execute the Phase 2 mv.
sim_archive(){ # $1=root $2=loop_mode $3=edge_yaml_file_or_empty
  root=$1; loop_mode=$2; edges=$3
  fdir="$root/active/F-940-finisher"
  if [ "$loop_mode" = "1" ]; then
    return 0  # loop iteration: no edge-write, no gate, no mv
  fi
  if [ -n "$edges" ]; then
    # append edges: list into the frontmatter (before the closing ---)
    awk -v ef="$edges" 'BEGIN{c=0} /^---$/{c++; if(c==2){while((getline l < ef)>0) print l}} {print}' \
      "$fdir/index.md" > "$fdir/index.md.new" && mv "$fdir/index.md.new" "$fdir/index.md"
  fi
  if python3 "$LINT" --root "$root" "$fdir" > "$root/lint-out.txt" 2>&1; then
    mv "$root/active/F-940-finisher" "$root/done/F-940-finisher"  # Phase 2
    return 0
  fi
  return 1  # terminal-block: no mv
}

# --- case A: good edge with full provenance → gate 0 → archive proceeds ---
make_tree "$tmp/a"
cat > "$tmp/a/edges.yaml" <<'EOF'
edges:
  - kind: relates_to
    id: F-941
    source: "index.md:17"
    evidence: "shares the sample-lineage mechanism (the body statement)"
    written_by: review-archive
    judge: {value: pass, rationale: "review confirmed the shared mechanism"}
EOF
if sim_archive "$tmp/a" 0 "$tmp/a/edges.yaml"; then
  ok "lint-clean edge: gate passes, archive proceeds"
else
  notok "lint-clean edge: gate passes, archive proceeds"
fi
[ -d "$tmp/a/done/F-940-finisher" ] && ok "feature mv'd to done/ after clean gate" || notok "feature mv'd to done/ after clean gate"
grep -q 'written_by: review-archive' "$tmp/a/done/F-940-finisher/index.md" && \
  grep -q 'judge: {value: pass' "$tmp/a/done/F-940-finisher/index.md" && \
  grep -q 'source: "index.md:17"' "$tmp/a/done/F-940-finisher/index.md" && \
  grep -q 'evidence: "shares the sample-lineage mechanism' "$tmp/a/done/F-940-finisher/index.md" && \
  ok "written edge carries full provenance (source/evidence/written_by/judge)" || \
  notok "written edge carries full provenance (source/evidence/written_by/judge)"

# --- case B: non-resolving source → gate non-zero → terminal-block, NO mv ---
make_tree "$tmp/b"
cat > "$tmp/b/edges.yaml" <<'EOF'
edges:
  - kind: relates_to
    id: F-941
    source: "nope.md:9"
    evidence: "bad provenance — file does not exist"
    written_by: review-archive
    judge: {value: pass, rationale: "n/a"}
EOF
if sim_archive "$tmp/b" 0 "$tmp/b/edges.yaml"; then
  notok "non-resolving source: gate blocks"
else
  ok "non-resolving source: gate blocks"
fi
[ -d "$tmp/b/active/F-940-finisher" ] && ok "terminal-block: feature STAYS in active/ (no mv)" || notok "terminal-block: feature STAYS in active/ (no mv)"
grep -q 'DEFECT' "$tmp/b/lint-out.txt" && ok "blocked archive lists the bad edges" || notok "blocked archive lists the bad edges"

# --- boundary (i): per-iteration loop-mode review writes NO edges ---
make_tree "$tmp/c"
sim_archive "$tmp/c" 1 "$tmp/c/does-not-matter.yaml"
if grep -q 'edges:' "$tmp/c/active/F-940-finisher/index.md"; then
  notok "loop-mode iteration writes NO edges"
else
  ok "loop-mode iteration writes NO edges"
fi
[ -d "$tmp/c/active/F-940-finisher" ] && ok "loop-mode iteration does not archive" || notok "loop-mode iteration does not archive"

# --- boundary (ii): zero genuine siblings → zero edges → gate passes clean ---
# (isolated judge: the tree must GENUINELY have no sibling — only the finisher exists)
mkdir -p "$tmp/d/active/F-940-finisher" "$tmp/d/done"
cat > "$tmp/d/active/F-940-finisher/index.md" <<'EOF'
---
id: F-940
title: "Fixture — finishing feature, alone in the tree"
status: active
created: 2026-07-03
---

# F-940 — finisher with no sibling anywhere
EOF
if sim_archive "$tmp/d" 0 ""; then
  ok "zero-siblings archive writes zero edges and gate passes clean"
else
  notok "zero-siblings archive writes zero edges and gate passes clean"
fi
[ -d "$tmp/d/done/F-940-finisher" ] && ok "zero-siblings archive still proceeds" || notok "zero-siblings archive still proceeds"

# ---------- part 2: wiring grep (F-067 lesson — prose must invoke the gate) ----------
region=$(sed -n '/^### Feature-level archive trigger/,/^#### Phase 2/p' "$SKILL")
case "$region" in
  *graph-lint.py*) ok "archive-trigger region invokes graph-lint.py";;
  *) notok "archive-trigger region invokes graph-lint.py";;
esac
case "$region" in
  *relates_to*) ok "archive-trigger region contains the relates_to edge-write";;
  *) notok "archive-trigger region contains the relates_to edge-write";;
esac
case "$region" in
  *"written_by: review-archive"*) ok "edge-write prescribes written_by: review-archive provenance";;
  *) notok "edge-write prescribes written_by: review-archive provenance";;
esac
case "$region" in
  *terminal-block*|*"terminal-block"*) ok "gate failure terminal-blocks the archive in prose";;
  *) notok "gate failure terminal-blocks the archive in prose";;
esac
# integration finding (F-069×F-070 pre-merge review): a blocked archive's re-run
# must be an archive-retry, not an ad-hoc re-review (else the feature dead-ends)
case "$region" in
  *archive-retry*) ok "blocked-archive re-run named as archive-retry in the trigger";;
  *) notok "blocked-archive re-run named as archive-retry in the trigger";;
esac
if rg -q 'Archive-retry exception' "$SKILL"; then
  ok "Output rule carries the archive-retry exception"
else
  notok "Output rule carries the archive-retry exception"
fi
case "$region" in
  *graph-index-gen.py*) ok "edge-write regenerates the layered index (graph-index-gen.py wired)";;
  *) notok "edge-write regenerates the layered index (graph-index-gen.py wired)";;
esac
# codex idempotence rule: re-append must dedupe by (kind, id)
case "$region" in
  *"kind, id"*|*"(kind, id)"*) ok "edge-write prescribes (kind,id) idempotence for re-runs";;
  *) notok "edge-write prescribes (kind,id) idempotence for re-runs";;
esac
# same-condition-as-archive: edge-write must be inside the trigger that loop
# iterations SKIP (the SKIP rule lives in the trigger's own "When" paragraph)
case "$region" in
  *SKIP*) ok "edge-write shares the archive's loop-iteration SKIP condition";;
  *) notok "edge-write shares the archive's loop-iteration SKIP condition";;
esac
# NOT near Check 7: the 60 lines after '### Check 7' must not invoke graph-lint.py
check7=$(grep -n '^### Check 7' "$SKILL" | head -1 | cut -d: -f1)
if [ -n "$check7" ]; then
  near=$(sed -n "${check7},$((check7 + 60))p" "$SKILL")
  case "$near" in
    *graph-lint.py*) notok "graph-lint.py NOT invoked near Check 7";;
    *) ok "graph-lint.py NOT invoked near Check 7";;
  esac
else
  ok "graph-lint.py NOT invoked near Check 7"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
