#!/bin/sh
# test-dag-e2e.sh — F-055: end-to-end DAG drive (check-dag + dag-next + advance-node + check-node together).
# Builds a real dag:true plan and drives it the way /ae:work does — loop dag-next → on NEXT
# create the deliverable + advance-node → until DONE — asserting the whole toolchain composes.
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPTS="$ROOT/plugins/ae/scripts"
for s in check-dag.sh dag-next.sh advance-node.sh check-node.sh; do
  [ -f "$SCRIPTS/$s" ] || { echo "FAIL: $s missing" >&2; exit 1; }
done
SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert(){ if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 — want '$2' got '$3'" >&2; fail=1; fi; }

cat > plan.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: root a
id: N1
depends: []
Expected files: a.txt
human-gate: false
### Step 2: root b
id: N2
depends: []
Expected files: b.txt
human-gate: false
### Step 3: join
id: N3
depends: [N1, N2]
Expected files: c.txt
human-gate: false
## Acceptance Criteria
### AC1: ref
- verify_by: integration
EOF
: > notes.md

# Validate first (the plan-review gate).
sh "$SCRIPTS/check-dag.sh" plan.md validate >/dev/null || { echo "FAIL: validate" >&2; exit 1; }

# Drive the DAG exactly like /ae:work: dag-next → NEXT/DONE/BLOCKED.
steps=0
while [ "$steps" -lt 20 ]; do
  steps=$((steps+1))
  set +e; out="$(sh "$SCRIPTS/dag-next.sh" plan.md notes.md 2>/dev/null)"; rc=$?; set -e
  case "$out" in
    DONE) break ;;
    BLOCKED) echo "  FAIL: unexpected BLOCKED (rc=$rc)" >&2; fail=1; break ;;
    "NEXT "*)
      id=$(printf '%s' "$out" | awk '{print $2}')
      num=$(printf '%s' "$out" | awk '{print $3}')
      # the "node work": create the declared deliverable (mirrors a real worker)
      case "$id" in N1) : > a.txt ;; N2) : > b.txt ;; N3) : > c.txt ;; esac
      sh "$SCRIPTS/advance-node.sh" plan.md "$num" "$id" notes.md >/dev/null
      ;;
    *) echo "  FAIL: unrecognized driver output '$out'" >&2; fail=1; break ;;
  esac
done

assert "drive terminated at DONE" "DONE" "$out"
assert "all three nodes pass in ledger" "3" "$(grep -c 'NODE_STATE N[123]: pass' notes.md)"
# provenance: a node whose deliverable was never created must NOT be pass
: > notes2.md; rm -f a.txt
set +e; sh "$SCRIPTS/dag-next.sh" plan.md notes2.md >/dev/null 2>&1
sh "$SCRIPTS/advance-node.sh" plan.md 1 N1 notes2.md >/dev/null 2>&1; set -e
if grep -q 'NODE_STATE N1: pass' notes2.md; then echo "  FAIL: faked pass with no deliverable" >&2; fail=1; else echo "  ok: no pass without the deliverable (e2e anti-theater)"; fi

[ "$fail" = 0 ] && echo "ok test-dag-e2e" || { echo "test-dag-e2e FAILED" >&2; exit 1; }
