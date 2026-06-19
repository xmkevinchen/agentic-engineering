#!/bin/sh
# discover-verifier.sh — F-047: standalone verifier-command detector.
#
# Purpose: when pipeline.yml `test.command` is empty, ae-flow-controller.sh needs to
# probe whether a project carries a conventional test command BEFORE declaring
# `missing-verifier`. This is that probe: a pure, side-effect-free detector.
#
# Contract:
#   discover-verifier.sh <dir>
#   - Found a verifier  → print the command to stdout, exit 0.
#   - None found        → print nothing (empty stdout), exit 0.
#   - Usage error       → one-line message to stderr, exit 2.
#                         (missing arg, or arg is not an existing directory)
#   The consumer tests `[ -n "$(discover-verifier.sh "$dir")" ]`; reserving non-zero
#   for real errors keeps "none found" distinct from "bad invocation".
#
# Pure detector: it NEVER executes the discovered command — it only emits the string.
#
# Probe table (first-match-wins; lower number wins the tiebreak):
#   1. Makefile `^test:` target          → make test
#   2. package.json non-empty .scripts.test (jq required) → npm test
#   3. tests/ with >=1 test_*.py / *_test.py (any depth)  → pytest
#   4. top-level *.test.sh / test.sh, lexicographically first → sh <basename>

set -u

# --- arg handling (check $# before reading $1 under set -u) ---
if [ "$#" -ne 1 ]; then
  echo "usage: discover-verifier.sh <dir>" >&2
  exit 2
fi
dir=$1
# Normalize a dash-leading relative path so grep/find don't parse it as an option.
case $dir in
  /*) ;;
  *) dir=./$dir ;;
esac
if [ ! -d "$dir" ]; then
  echo "discover-verifier.sh: not a directory: $dir" >&2
  exit 2
fi

# --- Convention 1: Makefile `test` target ---
# Note: `^test[[:blank:]]*:` matches `test:`, `test ::` and `test :` (POSIX make
# allows blanks before the colon) and also `test::` / `test:foo` (double-colon or
# multi-target) — the latter two are accepted false-positives for v1. A wrong
# `make test` guess lands harmlessly: the controller still pauses and /ae:work
# reports UNVERIFIED.
if [ -f "$dir/Makefile" ] && grep -q '^test[[:blank:]]*:' "$dir/Makefile"; then
  echo "make test"
  exit 0
fi

# --- Convention 2: package.json `test` script (jq-required) ---
# If jq is absent, skip this convention entirely — a grep/sed JSON scan is too fragile
# (pinned plan decision). select(type=="string" and length>0) excludes both JSON null
# and the empty string "".
if command -v jq >/dev/null 2>&1 && [ -f "$dir/package.json" ]; then
  if jq -er '.scripts.test | select(type == "string" and length > 0)' \
       "$dir/package.json" >/dev/null 2>&1; then
    echo "npm test"
    exit 0
  fi
fi

# --- Convention 3: pytest-runnable tests/ ---
# Structural file-presence only (never run pytest). The \( ... \) grouping is required
# so -o binds correctly against the implicit print; -type f avoids matching a directory
# named test_*.py. `-L` makes find follow a symlinked tests/ dir (the `[ -d ]` guard
# already follows it, so without -L find would see the link itself and not descend).
if [ -d "$dir/tests" ]; then
  if [ -n "$(find -L "$dir/tests" -type f \( -name 'test_*.py' -o -name '*_test.py' \) 2>/dev/null)" ]; then
    echo "pytest"
    exit 0
  fi
fi

# --- Convention 4: top-level shell test ---
# Probe <dir> (not recursive) for *.test.sh and test.sh; sort lexicographically, take
# the first; emit `sh <basename>` (the consumer cd's into the dir first, so an absolute
# path would break). Filenames with embedded newlines are an accepted out-of-scope edge.
sh_match=""
for f in "$dir"/*.test.sh "$dir"/test.sh; do
  [ -f "$f" ] || continue
  base=${f##*/}
  sh_match="$sh_match$base
"
done
if [ -n "$sh_match" ]; then
  first="$(printf '%s' "$sh_match" | LC_ALL=C sort | head -n 1)"
  if [ -n "$first" ]; then
    echo "sh $first"
    exit 0
  fi
fi

# No convention matched — empty stdout, success exit.
exit 0
