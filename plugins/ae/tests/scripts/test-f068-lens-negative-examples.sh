#!/bin/sh
# F-068 AC4 — soft-add lens negative/disambiguation examples present (BL-180).
# The F-067 soft-add mechanism is sound; the residual gap is CALIBRATION — the
# Agent Selection signal table carried only POSITIVE triggers, so an ambiguous
# diff (a game/render loop) could over-fire a `performance` lens. This asserts
# the negative/disambiguation examples are present in the canonical source
# (agent-selection/SKILL.md, which review/SKILL.md §3 references).
# Output: sh-tap `ok:` / `FAIL:` lines. parser: sh-tap.v1
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
SEL="$ROOT/plugins/ae/skills/agent-selection/SKILL.md"
fail=0
present() { # $1 desc, $2 pattern, $3 file
  if grep -qiE -- "$2" "$3"; then
    echo "ok: $1"
  else
    echo "FAIL: $1 (missing marker: $2 in $(basename "$3"))"
    fail=1
  fi
}
present "game/render loop is NOT by itself a performance signal" 'game/render.*loop is NOT' "$SEL"
present "performance needs a real hot-path/allocation/query concern" 'actual hot-path' "$SEL"
present "a disambiguation section is anchored in the signal table" 'disambiguation signal' "$SEL"
present "the rule is positive evidence, never a keyword" 'positive evidence' "$SEL"
[ "$fail" -eq 0 ] && echo "ALL PASS (F-068 AC4)" || echo "FAILURES (F-068 AC4)"
exit $fail
