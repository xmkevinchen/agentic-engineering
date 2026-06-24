#!/bin/sh
# test-f055-skill-wiring.sh — F-055 AC3: work DAG-drive uses the dag-next.sh driver loop (L1 fixture).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
W="$ROOT/plugins/ae/skills/work/SKILL.md"
fail=0
has(){ if grep -Fq -- "$2" "$W"; then echo "  ok: $1"; else echo "  FAIL: $1" >&2; fail=1; fi; }

has "driver loop uses dag-next.sh"        'dag-next.sh <plan>'
has "thin-driver framing"                 'thin-driver loop'
has "NEXT instruction handled"            'NEXT <id> <step-num>'
has "DONE handled"                        '`DONE` ⇒ every node is `pass`'
has "BLOCKED handled"                     '`BLOCKED` (exit 3)'
has "advance-node still owns verdict"     'advance-node.sh is the ONLY sanctioned writer'
has "ignition turtle shrinks"             'shrinks the ignition turtle'
has "ignition turtle not removed"         'does NOT remove it'

[ "$fail" = 0 ] && echo "ok test-f055-skill-wiring" || { echo "test-f055-skill-wiring FAILED" >&2; exit 1; }
