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
# Scope: the STATIC FRONTMATTER CONTRACT of every SKILL.md — the leading block's
# structure and the keys whose malformation the host swallows silently. Checks
# that need to run anything, or that concern content below the frontmatter,
# belong in tests/scripts/, not here.
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
  fm=$(sed -n "2,$((close - 1))p" "$skill")
  base=$(basename "$(dirname "$skill")")
  # Invariant: exactly one `name:` inside the leading block, holding the BARE
  # skill segment — the host prepends the plugin namespace itself, so a value
  # carrying it renders doubled. Matching the directory subsumes "no colon",
  # since no directory basename has one. Uniqueness matters because this reads
  # with sed while the host reads with a YAML parser: on a duplicate key a
  # first-match check would green a file the host resolves differently.
  ok=1
  keys=$(printf '%s\n' "$fm" | grep -c '^name:')
  if [ "$keys" -eq 0 ]; then
    echo "L1 FAIL: no 'name:' in leading frontmatter — $skill" >&2; rc=1; ok=0
  elif [ "$keys" -gt 1 ]; then
    echo "L1 FAIL: $keys 'name:' keys in leading frontmatter — $skill" >&2; rc=1; ok=0
  else
    nm=$(printf '%s\n' "$fm" | sed -n 's/^name: *//p')
    [ "$nm" = "$base" ] \
      || { echo "L1 FAIL: name '$nm' != directory '$base' (the bare segment is required; the host prepends the plugin namespace) — $skill" >&2; rc=1; ok=0; }
  fi
  # Only the hyphenated spelling is documented. A misspelled key is silently
  # ignored, and for this one that decides whether the command appears at all.
  if printf '%s\n' "$fm" | grep -q '^user_invocable:'; then
    echo "L1 FAIL: 'user_invocable' — the documented key is 'user-invocable' — $skill" >&2; rc=1; ok=0
  fi
  [ "$ok" -eq 1 ] || continue
  # One sh-tap line per skill actually checked. A bare "exit 0" cannot show the
  # loop examined anything; the per-skill lines are what make the evidence
  # non-vacuous to /ae:review's collector (parser: sh-tap.v1).
  echo "ok: $base frontmatter on-contract"
done

if [ "$n" -eq 0 ]; then echo "L1: no SKILL.md found under $dir" >&2; exit 2; fi
[ "$rc" -eq 0 ] && echo "L1 OK: $n skills passed structural checks ($dir)"
exit "$rc"
