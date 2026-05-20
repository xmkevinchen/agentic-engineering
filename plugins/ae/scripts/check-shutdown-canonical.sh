#!/bin/sh
# check-shutdown-canonical.sh — Plan 055 Step 1: CI grep for SendMessage shutdown_response inline drift
#
# v0.10.x schema grep script; v0.11.x candidate to upgrade to schema validator framework.
#
# Behavior:
# - For each agent .md file under plugins/ae/agents/:
#   - If file is in SHUTDOWN_EXEMPT whitelist → skip
#   - If file does NOT contain canonical reference link → fail (forces new agents to choose: reference OR explicit whitelist)
#   - If file contains inline shutdown_response JSON (any form: multi-line block, single-line, etc.) → fail
# - Exit 0 = all references canonical OR exempt. Exit 1 = inline detected OR new agent missing both reference and exemption.

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
AGENTS_DIR="$REPO_ROOT/plugins/ae/agents"
CANONICAL_DOC="$REPO_ROOT/plugins/ae/skills/agent-teams/SKILL.md"
REFERENCE_PATTERN="ae:agent-teams § Shutdown handshake (canonical)"

# Hard exclusion whitelist (per Plan 055 dep-analyst MF2):
# These agents have lifecycle contracts that don't use shutdown_response handshake.
# Adding new agents: either reference canonical OR add here with explicit rationale.
SHUTDOWN_EXEMPT="agents/engineering/minimal-change-engineer.md
agents/workflow/test-lead.md"

[ -d "$AGENTS_DIR" ] || { echo "[check-shutdown] error: agents dir not found at $AGENTS_DIR" >&2; exit 1; }
[ -f "$CANONICAL_DOC" ] || { echo "[check-shutdown] error: canonical doc not found at $CANONICAL_DOC" >&2; exit 1; }

# Verify canonical section exists in agent-teams SKILL.md
if ! grep -qE '^## Shutdown handshake \(canonical\)$' "$CANONICAL_DOC"; then
  echo "[check-shutdown] error: canonical section '## Shutdown handshake (canonical)' missing from $CANONICAL_DOC" >&2
  exit 1
fi

failures=0
exempt_count=0
referenced_count=0
total_count=0

# Use find to enumerate agent files
for f in $(find "$AGENTS_DIR" -type f -name '*.md' 2>/dev/null); do
  total_count=$((total_count + 1))
  relpath="${f#$REPO_ROOT/plugins/ae/}"

  # Whitelist check (newline-delimited string match)
  case "
$SHUTDOWN_EXEMPT
" in
    *"
$relpath
"*)
      exempt_count=$((exempt_count + 1))
      continue
      ;;
  esac

  # Inline detection: any line containing `"type": "shutdown_response"` JSON literal.
  # Covers: multi-line JSON block, single-line SendMessage inline, doodlestein simplified form.
  if grep -q '"type": "shutdown_response"' "$f" 2>/dev/null; then
    echo "[check-shutdown] FAIL: inline shutdown_response JSON detected in $relpath" >&2
    grep -n '"type": "shutdown_response"' "$f" | sed 's/^/    /' >&2
    failures=$((failures + 1))
    continue
  fi

  # Reference check: must contain the canonical reference pattern
  if grep -qF "$REFERENCE_PATTERN" "$f" 2>/dev/null; then
    referenced_count=$((referenced_count + 1))
  else
    echo "[check-shutdown] FAIL: agent missing both canonical reference and exemption: $relpath" >&2
    echo "    Fix options:" >&2
    echo "    (a) Reference: add [ae:agent-teams § Shutdown handshake (canonical)](../../skills/agent-teams/SKILL.md#shutdown-handshake-canonical) to file" >&2
    echo "    (b) Exempt: add '$relpath' to SHUTDOWN_EXEMPT array in $(basename "$0") with rationale" >&2
    failures=$((failures + 1))
  fi
done

echo "[check-shutdown] scanned=$total_count referenced=$referenced_count exempt=$exempt_count failures=$failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
