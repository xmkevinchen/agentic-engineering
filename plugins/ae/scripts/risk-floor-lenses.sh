#!/bin/sh
# risk-floor-lenses.sh — F-067 Step 1: the deterministic review-stage risk-floor.
#
# Emits the review lenses that MUST run regardless of the LLM soft-add, because the
# diff touches a safety-critical path. Pure shell, NO LLM call (a floor delegated to
# the LLM is not a floor — F-067 disc 001, codex precision condition). /ae:review runs
# this BEFORE the soft-add and writes the output to the `risk_floor_lenses` trace field;
# the soft-add can only ADD beyond this set, never remove a floor-forced lens.
#
# Usage: risk-floor-lenses.sh <paths-file> <patterns-file>
#   <paths-file>    : newline-separated changed-file paths (e.g. `git diff --name-only`)
#   <patterns-file> : newline-separated globs (the project's work.security_patterns)
# Output: one forced lens per line (currently only `security`; deduplicated). Empty = no floor.
# Exit: 0 always (a "no floor" result is empty stdout + exit 0, not an error).
#
# Honesty scope (F-067 Doodlestein F2): this is deterministic *given the current globs* —
# `work.security_patterns` is a user-maintained artifact that can drift from the codebase.
set -u

PATHS_FILE="${1:-}"
PATTERNS_FILE="${2:-}"

if [ -z "$PATHS_FILE" ] || [ -z "$PATTERNS_FILE" ]; then
  echo "usage: risk-floor-lenses.sh <paths-file> <patterns-file>" >&2
  exit 2
fi
# Missing files → no floor (graceful, non-blocking): empty output, exit 0.
[ -f "$PATHS_FILE" ] || exit 0
[ -f "$PATTERNS_FILE" ] || exit 0

security_forced=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  while IFS= read -r pat; do
    # Normalize a YAML list line into a bare glob (C-P2c): pipeline.yml stores
    # work.security_patterns as `  - "auth/*"`. Strip leading whitespace, a `- `/`-`
    # list marker, then surrounding double/single quotes. A pre-extracted bare glob
    # passes through unchanged.
    pat=${pat#"${pat%%[![:space:]]*}"}   # strip leading whitespace
    pat=${pat#- } ; pat=${pat#-}         # strip "- " or bare "-" list marker
    pat=${pat#"${pat%%[![:space:]]*}"}   # strip whitespace after the marker
    case $pat in
      \"*\") pat=${pat#\"}; pat=${pat%\"} ;;   # surrounding double quotes
      \'*\') pat=${pat#\'}; pat=${pat%\'} ;;   # surrounding single quotes
    esac
    [ -n "$pat" ] || continue
    # shellcheck disable=SC2254  # $pat is intentionally an unquoted glob pattern
    case "$path" in
      $pat) security_forced=1; break ;;
    esac
  done < "$PATTERNS_FILE"
  [ "$security_forced" -eq 1 ] && break
done < "$PATHS_FILE"

# Currently all work.security_patterns map to the `security` lens (auth/secret/migration =
# security-domain). Future lens domains (perf/etc) would add more pattern→lens maps here.
[ "$security_forced" -eq 1 ] && echo "security"
exit 0
