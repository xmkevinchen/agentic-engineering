#!/bin/sh
# parse-review-verdict.sh — F-048: normalize a review file's verdict to pass|fail|invalid.
#
# The leash loop branches on review.md's `verdict:` frontmatter. A missing / malformed /
# unknown / duplicated verdict must NOT silently read as pass or get skipped — it normalizes
# to `invalid`, which loop-decide.sh counts as fail (with a distinct diagnostic). This keeps a
# broken review from bypassing the cap.
#
# Usage:  parse-review-verdict.sh <review-file>   (or `-` to read stdin)
# Output: exactly one of `pass` / `fail` / `invalid` on stdout, exit 0.
#   invalid covers: no verdict: field, >1 verdict: field, or a value other than pass/fail.
# Usage error (wrong argc, file not found): stderr, exit 2.
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: parse-review-verdict.sh <review-file|->" >&2
  exit 2
fi

if [ "$1" = "-" ]; then
  content=$(cat)
else
  [ -f "$1" ] || { echo "parse-review-verdict.sh: not a file: $1" >&2; exit 2; }
  content=$(cat "$1")
fi

# Restrict to the LEADING YAML frontmatter block (between the first two '---' fences) —
# a 'verdict:' mentioned in the review BODY (e.g. discussing the schema) must NOT count
# (codex P2: whole-file counting turned a passing review with such a line into 'invalid').
fm=$(printf '%s\n' "$content" | awk 'NR==1 && $0!="---"{exit} NR==1{next} /^---$/{exit} {print}')

# Count verdict: lines in the frontmatter — 0 (missing) or >1 (duplicate) both → invalid.
n=$(printf '%s\n' "$fm" | grep -c '^verdict:')
if [ "$n" -ne 1 ]; then
  echo invalid
  exit 0
fi

# Extract the single value; strip whitespace, a trailing `# comment`, and surrounding quotes.
v=$(printf '%s\n' "$fm" | grep -m1 '^verdict:' \
    | sed -e 's/^verdict:[[:space:]]*//' -e 's/[[:space:]]*#.*$//' \
          -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/[[:space:]]*$//')

case $v in
  pass) echo pass ;;
  fail) echo fail ;;
  *)    echo invalid ;;
esac
exit 0
