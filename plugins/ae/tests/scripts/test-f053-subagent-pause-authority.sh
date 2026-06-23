#!/bin/sh
# test-f053-subagent-pause-authority.sh — F-053: structural pause-authority guarantee (L1 fixture).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
W="$ROOT/plugins/ae/skills/work/SKILL.md"
fail=0
has() { if grep -Fq -- "$2" "$W"; then echo "  ok: $1"; else echo "  FAIL: $1" >&2; fail=1; fi; }

# AC1 — structural pause-authority documented
has "F-053 structural pause-authority section" 'Structural pause-authority (F-053 / BL-148)'
has "subagent lacks AskUserQuestion (structural)" 'structurally lacks `AskUserQuestion`'
has "worker cannot pause / returns to TL" 'physically cannot pause-to-human mid-node'

# AC2 — solo-mode honest bound + ignition-turtle separation
has "solo-mode honest bound" 'in **solo mode** (`AGENT_TEAMS_FULL=false`'
has "ignition turtle separate residual" 'ignition turtle*'

[ "$fail" = 0 ] && echo "ok test-f053-subagent-pause-authority" || { echo "test-f053 FAILED" >&2; exit 1; }
