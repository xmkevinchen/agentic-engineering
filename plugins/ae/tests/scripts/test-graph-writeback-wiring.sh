#!/bin/sh
# The compounding loop's write-back forcing function (F-076): ONE canonical
# hook (analyze) referenced by 4 surfaces (plan/discuss/review/think) — never
# 5 divergent copies; MANDATORY disposition line (never skip-freely); per-
# surface sub-conditions (discuss: conclusion-time only; review: durability);
# plugin-stats carries NOTHING (negative assertion); query records are the
# disposition's durable payload with a reserved `query:` ledger token; and
# write-point-health COMPUTES yes-rate / per-source counts / the numeric
# dedup tripwire from a fixture ledger (runtime-shaped, not grep-green).
# sh-tap output (parser: sh-tap.v1).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"
SCRIPTS="$REPO/plugins/ae/scripts"
PY="${PYTHON:-python3}"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# --- 1. ONE canonical hook definition, four pointers (single-source shape)
n_canon=$(grep -l 'Write-back hook (the CANONICAL definition' "$SKILLS"/*/SKILL.md | wc -l | tr -d ' ')
[ "$n_canon" = "1" ] && ok "exactly one canonical hook definition (analyze)" || notok "exactly one canonical hook definition (found $n_canon)"
grep -q 'Write-back hook (the CANONICAL definition' "$SKILLS/analyze/SKILL.md" \
  && ok "canonical definition lives in analyze" || notok "canonical definition lives in analyze"
for s in plan discuss review think; do
  grep -q 'canonical definition lives in analyze/SKILL.md § Prior context step 9' "$SKILLS/$s/SKILL.md" \
    && ok "$s references the canonical hook (pointer, not copy)" || notok "$s references the canonical hook (pointer, not copy)"
done

# --- 2. MANDATORY disposition on all 5 surfaces; skip-freely is dead
for s in analyze plan discuss review think; do
  grep -q 'write-back candidate: yes/no' "$SKILLS/$s/SKILL.md" \
    && ok "$s carries the mandatory disposition line" || notok "$s carries the mandatory disposition line"
done
grep -q 'Skip freely' "$SKILLS/analyze/SKILL.md" \
  && notok "skip-freely wording removed from analyze" || ok "skip-freely wording removed from analyze"

# --- 3. per-surface sub-conditions
grep -q 'fires ONCE, at conclusion time' "$SKILLS/discuss/SKILL.md" \
  && ok "discuss: conclusion-time-only clause" || notok "discuss: conclusion-time-only clause"
grep -q 'NEVER per-round' "$SKILLS/discuss/SKILL.md" \
  && ok "discuss: never-per-round clause" || notok "discuss: never-per-round clause"
grep -q 'useful AFTER the defect is fixed' "$SKILLS/review/SKILL.md" \
  && ok "review: durability sub-question" || notok "review: durability sub-question"

# --- 4. plugin-stats carries NOTHING (negative assertion)
grep -q 'write-back candidate' "$SKILLS/plugin-stats/SKILL.md" \
  && notok "plugin-stats has no write-back hook" || ok "plugin-stats has no write-back hook"
grep -q 'query: record' "$SKILLS/plugin-stats/SKILL.md" \
  && notok "plugin-stats appends no query record" || ok "plugin-stats appends no query record"

# --- 5. query records: reserved token + durable payload + append-only, on all 5
for s in analyze plan discuss review think; do
  grep -q 'query:` record' "$SKILLS/$s/SKILL.md" \
    && ok "$s appends a query record" || notok "$s appends a query record"
done
grep -q 'reserved and disjoint from `check:` / `add-page:` / `add-edges:` / `backfill:` / `dedup:` / `rejected:`' "$SKILLS/analyze/SKILL.md" \
  && ok "query token reserved against the other ledger kinds" || notok "query token reserved against the other ledger kinds"

# --- 6. filed pages are edge-targetable (binding constraint 1 pin — Step 3 shipped first)
grep -q 'edge-targetable' "$SKILLS/analyze/SKILL.md" \
  && ok "canonical hook: filed page is edge-targetable" || notok "canonical hook: filed page is edge-targetable"

# --- 7. LIVE append: one query record, prior bytes an exact prefix
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/graph"
printf -- "- 2026-07-05T00:00:00Z add-page: syn-x (1 anchor(s))\n" > "$TMP/graph/log.md"
before="$(cat "$TMP/graph/log.md")"
printf -- "- 2026-07-05T01:00:00Z query: analyze fixture lookup — write-back candidate: no — nothing novel\n" >> "$TMP/graph/log.md"
case "$(cat "$TMP/graph/log.md")" in
  "$before"*) ok "append-only: prior log bytes are an exact prefix";;
  *) notok "append-only: prior log bytes are an exact prefix";;
esac
n_q=$(grep -c '^- [^ ]* query: ' "$TMP/graph/log.md")
[ "$n_q" = "1" ] && ok "exactly one query record appended" || notok "exactly one query record appended"

# --- 8. write-point-health COMPUTES from a fixture ledger (runtime, not grep)
cat > "$TMP/graph/log.md" <<'EOF'
- 2026-07-05T00:00:00Z backfill: 2 edge(s)
- 2026-07-05T00:01:00Z query: analyze topic a — write-back candidate: yes — novel subsystem
- 2026-07-05T00:02:00Z query: plan topic b — write-back candidate: no — already covered
- 2026-07-05T00:03:00Z query: review topic c — write-back candidate: no — transient defect
- 2026-07-05T00:04:00Z query: think topic d — write-back candidate: yes — cross-cutting tradeoff
- 2026-07-05T00:05:00Z add-edges: F-901: 1 edge(s) [lint]
- 2026-07-05T00:06:00Z add-edges: F-902: 2 edge(s) [writeback]
- 2026-07-05T00:07:00Z add-edges: F-903: 1 edge(s)
EOF
out8="$("$PY" "$SCRIPTS/graph-writeback-health.py" --graph-dir "$TMP/graph" 2>&1)"
case "$out8" in *"queries: 4 (yes: 2, no: 2, undisposed: 0, yes-rate: 50%)"*) ok "yes-rate COMPUTED from the ledger (50%)";; *) notok "yes-rate COMPUTED from the ledger ($out8)";; esac
case "$out8" in *"lint: 1"*) ok "per-source breakdown: lint counted";; *) notok "per-source breakdown: lint counted";; esac
case "$out8" in *"writeback: 1"*) ok "per-source breakdown: writeback counted";; *) notok "per-source breakdown: writeback counted";; esac
case "$out8" in *"untagged: 1"*) ok "per-source breakdown: untagged counted";; *) notok "per-source breakdown: untagged counted";; esac

# --- 9. numeric tripwire: 10 batch pages since last dedup → FORCED; a dedup
#        record resets the counter
i=1; : > "$TMP/graph/log.md"
while [ $i -le 10 ]; do
  printf -- "- 2026-07-05T00:00:00Z add-page: syn-p%s (1 anchor(s))\n" "$i" >> "$TMP/graph/log.md"
  i=$((i + 1))
done
out9="$("$PY" "$SCRIPTS/graph-writeback-health.py" --graph-dir "$TMP/graph" 2>&1)"
case "$out9" in *"batch pages since last dedup pass: 10 (tripwire N=10: FORCED"*) ok "tripwire FORCED at N=10";; *) notok "tripwire FORCED at N=10 ($out9)";; esac
printf -- "- 2026-07-05T01:00:00Z dedup: pass over 10 pages, 0 duplicates\n" >> "$TMP/graph/log.md"
out9b="$("$PY" "$SCRIPTS/graph-writeback-health.py" --graph-dir "$TMP/graph" 2>&1)"
case "$out9b" in *"batch pages since last dedup pass: 0 (tripwire N=10: OK)"*) ok "dedup record resets the tripwire counter";; *) notok "dedup record resets the tripwire counter ($out9b)";; esac

# --- 9b. independent denominator: trace invocations vs query records (the
#         append-layer-death smoke alarm — queries:0 alone cannot distinguish
#         "skills never ran" from "the append layer died")
mkdir -p "$TMP/traces"
cat > "$TMP/traces/s1.ndjson" <<'EOF'
{"ts":"2026-07-05T00:00:00Z","skill":"ae:analyze","outcome":"pass"}
{"ts":"2026-07-05T00:01:00Z","skill":"ae:plan","outcome":"pass"}
{"ts":"2026-07-05T00:02:00Z","skill":"ae:backlog","outcome":"pass"}
{"ts":"2026-07-05T00:03:00Z","skill":"ae:review","outcome":"pass"}
EOF
: > "$TMP/graph/log.md"
printf -- "- 2026-07-05T00:01:00Z query: analyze topic — write-back candidate: no — nothing\n" >> "$TMP/graph/log.md"
out9c="$("$PY" "$SCRIPTS/graph-writeback-health.py" --graph-dir "$TMP/graph" --traces-dir "$TMP/traces" 2>&1)"
case "$out9c" in *"invocations in traces: 3 vs query records: 1 (gap: 2 — POSITIVE GAP"*) ok "denominator: positive gap flags append-layer death";; *) notok "denominator: positive gap flags append-layer death ($out9c)";; esac

# --- 9c. REJECTED proposals are durable ledger records (the resample pool's
#         lint half — a rejection that only hits stdout is invisible to the
#         next refresh) and health COUNTS them per source
cat >> "$TMP/graph/log.md" <<'EOF'
- 2026-07-05T02:00:00Z rejected: F-901: part_of -> F-902 [lint] lint-revert
- 2026-07-05T02:01:00Z rejected: F-902: relates_to -> Q-9 [writeback] unclassifiable-target
EOF
out9d="$("$PY" "$SCRIPTS/graph-writeback-health.py" --graph-dir "$TMP/graph" 2>&1)"
case "$out9d" in *"rejected proposals by source (resample-pool input): lint: 1, writeback: 1"*) ok "rejected records counted per source";; *) notok "rejected records counted per source ($out9d)";; esac

# live rejection writes the ledger record: drive an illegal row through
# add-edges against a fixture tree and assert the rejected: record lands
FIXT="$REPO/plugins/ae/tests/fixtures/graph-topology"
TREE="$TMP/tree9"
cp -R "$FIXT" "$TREE"
cat > "$TMP/badrow.json" <<'EOF'
[{"from": "F-901", "kind": "part_of", "target": "F-902", "line": 20,
  "evidence": "illegal", "rationale": "must be rejected", "proposal_source": "lint"}]
EOF
"$PY" "$SCRIPTS/graph-refresh.py" add-edges "$TMP/badrow.json" --root "$TREE/features" --repo-root "$TREE" >/dev/null 2>&1
grep -q 'rejected: F-901: part_of -> F-902 \[lint\] lint-revert' "$TREE/graph/log.md" 2>/dev/null \
  && ok "live rejection lands as a durable rejected: record" || notok "live rejection lands as a durable rejected: record"

# --- 10. refresh wires the health run + the adversarial no-resample
KR="$SKILLS/knowledge-refresh/SKILL.md"
grep -q 'graph-writeback-health.py' "$KR" \
  && ok "refresh runs write-point health (computed, not promised)" || notok "refresh runs write-point health (computed, not promised)"
grep -q 'sample ≥2 of' "$KR" && grep -q '`no` dispositions AND ≥1 of the' "$KR" \
  && ok "refresh resample pool covers no-dispositions AND rejected records" || notok "refresh resample pool covers no-dispositions AND rejected records"
grep -q 'N=10' "$KR" \
  && ok "refresh states the numeric tripwire" || notok "refresh states the numeric tripwire"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
