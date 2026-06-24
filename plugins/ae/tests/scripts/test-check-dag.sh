#!/bin/sh
# test-check-dag.sh — F-054 Phase-1 AC1/AC2: DAG validate + ready-set.
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
CD="$ROOT/plugins/ae/scripts/check-dag.sh"
[ -f "$CD" ] || { echo "FAIL: check-dag.sh not found" >&2; exit 1; }
SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert(){ if [ "$2" = "$3" ]; then echo "  ok: $1 (exit $3)"; else echo "  FAIL: $1 — want $2 got $3" >&2; fail=1; fi; }
rc(){ set +e; sh "$CD" "$@" >/dev/null 2>&1; r=$?; set -e; echo "$r"; }

# --- valid DAG ---
cat > good.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: root (AC1)
id: N1
depends: []
Expected files: a.txt
human-gate: false
### Step 2: dependent (AC2)
id: N2
depends: [N1]
Expected files: b.txt
human-gate: false
### Step 3: join (AC3)
id: N3
depends: [N1, N2]
Expected files: c.txt
human-gate: false
## Acceptance Criteria
### AC1: ref
- verify_by: unit
EOF
assert "valid acyclic dag → 0" 0 "$(rc good.md validate)"

# --- legacy (no dag: true) → no-op 0 ---
cat > legacy.md <<'EOF'
## Steps
### Step 1: x
Expected files: a.txt
EOF
assert "legacy plan (no dag:true) → no-op 0" 0 "$(rc legacy.md validate)"

# --- cycle ---
cat > cycle.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: [N2]
Expected files: a.txt
human-gate: false
### Step 2: b
id: N2
depends: [N1]
Expected files: b.txt
human-gate: false
EOF
assert "cycle → fail 1" 1 "$(rc cycle.md validate)"

# --- dangling depends ---
cat > dangle.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: [N9]
Expected files: a.txt
human-gate: false
EOF
assert "dangling depends → fail 1" 1 "$(rc dangle.md validate)"

# --- auto-node without harness ---
cat > noharness.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: []
human-gate: false
EOF
assert "auto-node no harness → fail 1" 1 "$(rc noharness.md validate)"

# --- a judge node (human-gate true) without harness is OK ---
cat > judgenode.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: []
Expected files: a.txt
human-gate: false
### Step 2: judged
id: N2
depends: [N1]
human-gate: true
EOF
assert "human-gate node without harness → ok 0" 0 "$(rc judgenode.md validate)"

# --- backend: workflow illegal ---
cat > badbackend.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: []
Expected files: a.txt
human-gate: false
backend: workflow
EOF
assert "backend: workflow → fail 1" 1 "$(rc badbackend.md validate)"

# --- node missing id ---
cat > noid.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
depends: []
Expected files: a.txt
human-gate: false
EOF
assert "dag plan, node missing id → fail 1" 1 "$(rc noid.md validate)"

# --- ready-set + terminal signals ---
echo "  -- ready-set (good.md: N1 root; N2 dep N1; N3 dep N1,N2) --"
readyset(){ sh "$CD" good.md ready "$1" 2>/dev/null | tr '\n' ' ' | sed 's/ $//'; }
: > empty-ledger.txt
got="$(readyset empty-ledger.txt)"; [ "$got" = "N1" ] && echo "  ok: empty ledger → only N1 ready" || { echo "  FAIL: empty → '$got' (want N1)" >&2; fail=1; }
printf 'NODE_STATE N1: pass\n' > l1.txt
got="$(readyset l1.txt)"; [ "$got" = "N2" ] && echo "  ok: N1 pass → N2 ready" || { echo "  FAIL: N1pass → '$got' (want N2)" >&2; fail=1; }
printf 'NODE_STATE N1: pass\nNODE_STATE N2: pass\n' > l2.txt
got="$(readyset l2.txt)"; [ "$got" = "N3" ] && echo "  ok: N1+N2 pass → N3 ready" || { echo "  FAIL: N1N2pass → '$got' (want N3)" >&2; fail=1; }
# in_progress node is RE-PICKED (crash-resume)
printf 'NODE_STATE N1: pass\nNODE_STATE N2: in_progress\n' > l3.txt
got="$(readyset l3.txt)"; [ "$got" = "N2" ] && echo "  ok: N2 in_progress → N2 re-picked (crash-resume)" || { echo "  FAIL: → '$got' (want N2)" >&2; fail=1; }
# all pass → __DONE__ signal
printf 'NODE_STATE N1: pass\nNODE_STATE N2: pass\nNODE_STATE N3: pass\n' > ldone.txt
got="$(readyset ldone.txt)"; [ "$got" = "__DONE__" ] && echo "  ok: all pass → __DONE__" || { echo "  FAIL: → '$got' (want __DONE__)" >&2; fail=1; }
assert "all pass → __DONE__ exit 0" 0 "$(set +e; sh "$CD" good.md ready ldone.txt >/dev/null 2>&1; echo $?)"
# a FAILED node is re-runnable (retry) — root with no deps → ready again
printf 'NODE_STATE N1: fail\n' > lfail.txt
got="$(readyset lfail.txt)"; [ "$got" = "N1" ] && echo "  ok: N1 fail → N1 ready (retry, bounded by cap→gate)" || { echo "  FAIL: → '$got' (want N1)" >&2; fail=1; }
# a GATE node (cap-exhausted / human-escalated) blocks the frontier → __BLOCKED__ (exit 3)
printf 'NODE_STATE N1: gate\n' > lblk.txt
got="$(readyset lblk.txt)"; [ "$got" = "__BLOCKED__" ] && echo "  ok: N1 gate → __BLOCKED__ (escalated, N2/N3 dep-blocked)" || { echo "  FAIL: → '$got' (want __BLOCKED__)" >&2; fail=1; }
assert "gate-blocked → exit 3" 3 "$(set +e; sh "$CD" good.md ready lblk.txt >/dev/null 2>&1; echo $?)"

# --- P2-1: section guard — an `### AC` block with a bare id: must NOT register as a node ---
cat > acguard.md <<'EOF'
---
dag: true
---
## Steps
### Step 1: a
id: N1
depends: []
Expected files: a.txt
human-gate: false
## Acceptance Criteria
### AC1: out
id: should-not-be-a-node
- verify_by: unit
EOF
assert "AC block with bare id: not parsed as node → valid 0" 0 "$(rc acguard.md validate)"
got="$(sh "$CD" acguard.md ready empty-ledger.txt 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
[ "$got" = "N1" ] && echo "  ok: section guard — only N1 is a node (AC id ignored)" || { echo "  FAIL: → '$got' (want N1)" >&2; fail=1; }

[ "$fail" = 0 ] && echo "ok test-check-dag" || { echo "test-check-dag FAILED" >&2; exit 1; }
