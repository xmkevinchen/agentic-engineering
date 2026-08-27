#!/bin/sh
# Deletion sweep — delete every refusal in turn, and report the ones the suite
# does not notice.
#
# The hand-written mutation check plants defects someone thought of. This plants
# the same defect at every site there is: each `fail(...)` and each
# `return '<code>'` is a refusal, and a refusal whose removal leaves the suite
# green is a refusal nothing holds to account.
#
# Every review pass for nine consecutive rounds found at least one of those by
# hand. This is that search, done exhaustively, so it stops being something a
# reviewer has to remember to do.
#
# Slow by nature — one suite run per site — so it is deliberate, not part of the
# standard suite. Like the mutation check, it never writes to the repository:
# the slice is copied and the copy is edited.
#
# Run: sh plugins/ae/v1/test/deletion-sweep.sh [file.mjs ...]
set -u
V1=$(cd "$(dirname "$0")/.." && pwd)
AE_REPO_ROOT=$(cd "$V1/../../.." && pwd)
export AE_REPO_ROOT

RUNDIR=$(mktemp -d "${TMPDIR:-/tmp}/ae-sweep.XXXXXX")
trap 'rm -rf "$RUNDIR"' EXIT INT TERM PIPE
cp -R "$V1" "$RUNDIR/v1"
WORK="$RUNDIR/v1"

TARGETS=${*:-"lib/admissibility.mjs lib/gate.mjs lib/identity.mjs lib/family.mjs lib/kernel.mjs lib/schema.mjs lib/write-path.mjs"}

survivors=0
checked=0

for rel in $TARGETS; do
  src="$V1/$rel"
  [ -f "$src" ] || continue

  # Line numbers of every refusal site in this file.
  lines=$(grep -n "fail('\|return '[a-z_]*';" "$src" | cut -d: -f1)

  for n in $lines; do
    checked=$((checked + 1))
    # Restore, then neuter this one site. `fail(` becomes a call to a no-op and
    # `return 'code'` becomes a fall-through, which is what deleting the refusal
    # means in each shape.
    cp "$src" "$WORK/$rel"
    python3 - "$WORK/$rel" "$n" <<'PY'
import io, sys
path, n = sys.argv[1], int(sys.argv[2])
lines = io.open(path, encoding='utf-8').read().split('\n')
line = lines[n - 1]
if "fail('" in line:
    lines[n - 1] = line.replace("fail('", "(() => {})('", 1)
elif "return '" in line:
    lines[n - 1] = line.replace("return '", "0 && '", 1)
io.open(path, 'w', encoding='utf-8').write('\n'.join(lines))
PY
    if node "$WORK/test/all.mjs" >/dev/null 2>&1; then
      survivors=$((survivors + 1))
      printf 'SURVIVED  %s:%s  %s\n' "$rel" "$n" "$(sed -n "${n}p" "$src" | sed 's/^ *//' | cut -c1-72)"
    fi
  done
  cp "$src" "$WORK/$rel"
done

echo ""
echo "$checked refusal sites; $survivors survived"
[ "$survivors" -eq 0 ] || exit 1
