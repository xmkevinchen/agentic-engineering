#!/bin/sh
# test-dag-next.sh — F-055 AC1/AC2: thin DAG driver emits the right instruction + commit-before-execute.
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
DN="$ROOT/plugins/ae/scripts/dag-next.sh"
[ -f "$DN" ] || { echo "FAIL: dag-next.sh not found" >&2; exit 1; }
SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert(){ if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 — want '$2' got '$3'" >&2; fail=1; fi; }
# run: sets OUT (stdout, trailing newline stripped) and RC (exit code)
run(){ set +e; OUT="$(sh "$DN" "$@" 2>/dev/null)"; RC=$?; set -e; }

cat > dag.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: root
id: N1
depends: []
Expected files: a.txt
human-gate: false
### Step 2: dep
id: N2
depends: [N1]
Expected files: b.txt
human-gate: false
## Acceptance Criteria
### AC1: ref
- verify_by: unit
EOF

: > led.txt
run dag.md led.txt
assert "empty → NEXT N1 1" "NEXT N1 1" "$OUT"; assert "  exit 0" 0 "$RC"
assert "commit-before-execute wrote in_progress" "NODE_STATE N1: in_progress" "$(tail -1 led.txt)"

run dag.md led.txt
assert "re-run → re-pick NEXT N1 (in_progress)" "NEXT N1 1" "$OUT"

printf 'NODE_STATE N1: pass\n' >> led.txt
run dag.md led.txt
assert "N1 pass → NEXT N2 2" "NEXT N2 2" "$OUT"

printf 'NODE_STATE N2: pass\n' >> led.txt
run dag.md led.txt
assert "all pass → DONE" "DONE" "$OUT"; assert "  exit 0" 0 "$RC"

: > ledg.txt; printf 'NODE_STATE N1: gate\n' >> ledg.txt
run dag.md ledg.txt
assert "gate → BLOCKED" "BLOCKED" "$OUT"; assert "  exit 3" 3 "$RC"

cat > lin.md <<'EOF'
## Steps
### Step 1: x
Expected files: a.txt
EOF
: > ledl.txt
run lin.md ledl.txt
assert "non-dag → LEGACY" "LEGACY" "$OUT"; assert "  exit 0" 0 "$RC"

[ "$fail" = 0 ] && echo "ok test-dag-next" || { echo "test-dag-next FAILED" >&2; exit 1; }
