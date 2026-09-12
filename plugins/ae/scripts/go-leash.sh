#!/bin/bash
# The done-leash: refuse to let a /ae:go-driven turn end while a stage it just ran has not
# been confirmed. Registered via go/SKILL.md's own frontmatter `hooks.Stop`, `once: true` — see
# docs/references/hooks.md "AE's minimal hook set" (H1) for the design and its 2026-08-29 probe,
# and F-108's analysis.md for the re-probe against a newer host version.
#
# Never a second judgment about what "conforming" means: this always delegates to
# check-stage-delivery.py, the same script go/SKILL.md's own prose already runs by hand.
#
# The marker it looks for is `.ae-go-marker` directly under a feature directory, written by
# go/SKILL.md right after a stage's skill returns and cleared once check-stage-delivery.py has
# passed for that stage. No marker anywhere under this project's feature roots -> nothing was
# left in flight -> exit 0 immediately, no scan cost beyond one glob.
#
# A Stop hook's process cwd is the project directory (same convention check-cross-family.sh
# relies on for SessionStart).

set -u

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
AE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SELF_DIR/.." && pwd)}"
CHECKER="$AE_PLUGIN_ROOT/scripts/check-stage-delivery.py"

MARKER_NAME=".ae-go-marker"
FEATURE_ROOTS=(".ae/features/active" ".ae/features/paused")

markers=()
for root in "${FEATURE_ROOTS[@]}"; do
  [ -d "$root" ] || continue
  while IFS= read -r m; do
    markers+=("$m")
  done < <(find "$root" -mindepth 2 -maxdepth 2 -name "$MARKER_NAME" 2>/dev/null)
done

if [ "${#markers[@]}" -eq 0 ]; then
  exit 0
fi

# More than one in-flight marker in one checkout is not this script's to arbitrate: guessing
# which one belongs to this turn risks exactly AC6's falsifier (judging the wrong feature).
# This project's own convention is a worktree per concurrently-worked feature, so more than one
# marker here means that convention was not followed -- name it and stop, rather than pick one.
if [ "${#markers[@]}" -gt 1 ]; then
  {
    echo "go-leash: more than one in-flight stage marker found in this checkout -- refusing to"
    echo "guess which one this turn belongs to. Close or clear all but the right one, or split"
    echo "the other feature(s) into their own worktree (see CLAUDE.md's git conventions):"
    printf '  %s\n' "${markers[@]}"
  } >&2
  exit 2
fi

marker="${markers[0]}"
feature_dir="$(dirname "$marker")"
stage="$(sed -n 's/^stage: *//p' "$marker" | head -n1)"

if [ -z "$stage" ]; then
  echo "go-leash: $marker exists but names no stage (expected a 'stage: <name>' line) -- treating this as an unclosed marker and refusing the stop until it is fixed or removed." >&2
  exit 2
fi

output="$(python3 "$CHECKER" "$feature_dir" "$stage" 2>&1)"
status=$?

if [ "$status" -eq 0 ]; then
  exit 0
fi

echo "$output" >&2
exit 2
