#!/bin/sh
# next-bl-id.sh — canonical single-source BL number allocator (F-042).
#
# Prints the next free BL number, zero-padded to 3 digits (e.g. 197), by
# UNION-scanning two locations so a promoted BL is never invisible to allocation:
#   1. the backlog dir  — `output.backlog` from .claude/pipeline.yml (default .ae/backlog/), recursive
#   2. the feature dirs — .ae/features/{active,done,abandoned,paused}/F-*/BL-*.md (one level; fixed AE path)
#
# Every BL-writing path (backlog capture + discuss/review/work defer sites) MUST
# call this instead of computing max+1 itself — one source, no drift, and the
# feature-dir arm closes the promote-invisibility reuse (F-042). Deterministic
# max+1 over the physical filesystem; NO locking/atomicity (that race fix was
# rejected — no concurrency evidence; the scan self-heals from the real tree).
#
# Run from the repo root (skills + ae-run-tests.sh do). Backlog path is
# configurable; the .ae/features/ layout is fixed AE convention (external
# projects lacking it simply match nothing there — harmless).
set -u

PIPELINE=".claude/pipeline.yml"
BACKLOG=".ae/backlog"
if [ -f "$PIPELINE" ]; then
  cfg=$(sed -n '/^output:/,/^[^[:space:]#]/p' "$PIPELINE" 2>/dev/null \
        | sed -nE 's/^[[:space:]]+backlog:[[:space:]]*"?([^"#[:space:]]+)"?.*/\1/p' | head -1)
  [ -n "${cfg:-}" ] && BACKLOG="$cfg"
fi
BACKLOG=${BACKLOG%/}

n=$(
  {
    find "$BACKLOG" -type f -name 'BL-*.md' 2>/dev/null
    find .ae/features/active .ae/features/done .ae/features/abandoned .ae/features/paused \
         -mindepth 2 -maxdepth 2 -type f -name 'BL-*.md' 2>/dev/null
  } | sed -E 's#.*/BL-0*([0-9]+).*#\1#' | grep -E '^[0-9]+$' | sort -n | tail -1
)
[ -z "${n:-}" ] && n=0
printf '%03d\n' "$((n + 1))"
