#!/bin/sh
# test-advance-node.sh — F-054 Phase-1: advance-node.sh provenance (NODE_STATE pass only on a real check-node verdict).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
ADV="$ROOT/plugins/ae/scripts/advance-node.sh"
[ -f "$ADV" ] || { echo "FAIL: advance-node.sh not found" >&2; exit 1; }
SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert(){ if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 — want '$2' got '$3'" >&2; fail=1; fi; }

cat > plan.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: makes a file (AC1)
id: N1
depends: []
Expected files: out/made.txt
human-gate: false
## Acceptance Criteria
### AC1: ref
- verify_by: integration
EOF
mkdir -p out

# deliverable MISSING → check-node fails → advance-node writes fail, NOT pass (provenance)
: > ledger.txt
v="$(set +e; sh "$ADV" plan.md 1 N1 ledger.txt >/dev/null 2>&1; echo $?)"
assert "missing deliverable → advance-node exit 1" 1 "$v"
assert "ledger got fail (not pass)" "NODE_STATE N1: fail" "$(grep '^NODE_STATE N1' ledger.txt | tail -1)"

# deliverable PRESENT → check-node passes → advance-node writes pass
: > ledger.txt; : > out/made.txt
v="$(set +e; sh "$ADV" plan.md 1 N1 ledger.txt >/dev/null 2>&1; echo $?)"
assert "present deliverable → advance-node exit 0" 0 "$v"
assert "ledger got pass (provenance = check-node exit)" "NODE_STATE N1: pass" "$(grep '^NODE_STATE N1' ledger.txt | tail -1)"

# the caller cannot fake a pass: even with garbage args the verdict comes from check-node,
# and a missing deliverable can never yield pass.
rm -f out/made.txt; : > ledger.txt
sh "$ADV" plan.md 1 N1 ledger.txt >/dev/null 2>&1 || true
if grep -q 'NODE_STATE N1: pass' ledger.txt; then echo "  FAIL: faked pass on missing deliverable" >&2; fail=1; else echo "  ok: no pass written when deliverable absent (anti-theater)"; fi

# id/step-num mismatch → refuse, write NO ledger entry (provenance: verdict recorded against
# the step actually run, not a caller-supplied wrong id).
: > ledger.txt; : > out/made.txt
v="$(set +e; sh "$ADV" plan.md 1 N2 ledger.txt >/dev/null 2>&1; echo $?)"
assert "id mismatch (step 1 is N1, caller said N2) → exit 2" 2 "$v"
if grep -q 'NODE_STATE' ledger.txt; then echo "  FAIL: wrote a ledger entry for a mismatched id" >&2; fail=1; else echo "  ok: no ledger entry written on id mismatch"; fi

[ "$fail" = 0 ] && echo "ok test-advance-node" || { echo "test-advance-node FAILED" >&2; exit 1; }
