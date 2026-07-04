#!/bin/sh
# ae-test-plugin-regression-layer1.sh — F-048: AE's deterministic L1 protocol oracle.
#
# AE is a prose repo with no conventional test runner, so the F-048 loop would otherwise gate
# judge-only on AE itself. This is AE's real deterministic oracle (conclusion D5b′): a pure
# structural static analysis of the plugin's skills. NO `claude -p`, NO LLM.
#
# Intended as the single source for the L1 static pass (resolving the "slash command isn't
# shell-runnable" contradiction, codex MF-2):
#   - `pipeline.yml` `test.command` points here NOW (so /ae:work's gate + the harness loop run it).
#   - Wiring `/ae:test-plugin --regression --layer1` to DELEGATE here is a follow-up —
#     test-plugin/SKILL.md is not yet updated (honest: not yet the single source for BOTH).
#
# Usage: ae-test-plugin-regression-layer1.sh [skills-dir]   (default: plugins/ae/skills)
# Exit 0 = all L1 invariants hold; non-zero = a structural violation (offending file on stderr).
set -u
dir=${1:-plugins/ae/skills}
[ -d "$dir" ] || { echo "L1: not a directory: $dir" >&2; exit 2; }

rc=0
n=0
for skill in "$dir"/*/SKILL.md; do
  [ -f "$skill" ] || continue
  n=$((n + 1))
  # Constrain checks to a PROPERLY-OPENED-AND-CLOSED LEADING frontmatter block:
  # an anywhere-match for 'name: ae:' + any two '---' would false-green a malformed skill.
  if [ "$(sed -n '1p' "$skill")" != "---" ]; then
    echo "L1 FAIL: no leading '---' frontmatter fence on line 1 — $skill" >&2; rc=1; continue
  fi
  close=$(awk 'NR>1 && /^---$/{print NR; exit}' "$skill")   # line number of the closing fence
  if [ -z "$close" ]; then
    echo "L1 FAIL: leading frontmatter not closed — $skill" >&2; rc=1; continue
  fi
  # Invariant: `name: ae:` declared INSIDE the leading block (lines 2..close-1).
  sed -n "2,$((close - 1))p" "$skill" | grep -q '^name: ae:' \
    || { echo "L1 FAIL: missing 'name: ae:' in leading frontmatter — $skill" >&2; rc=1; }
done

if [ "$n" -eq 0 ]; then echo "L1: no SKILL.md found under $dir" >&2; exit 2; fi
[ "$rc" -eq 0 ] && echo "L1 OK: $n skills passed structural checks ($dir)"
exit "$rc"
