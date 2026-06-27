#!/bin/sh
# test-check-agent-teams.sh — canonical Agent Teams detection (the false-negative fix).
set -u
HERE=$(dirname "$0")
SCRIPT="$HERE/../../scripts/check-agent-teams.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/.claude"
fail=0

chk() { desc="$1"; exp="$2"; shift 2; "$@" >/dev/null 2>&1; got=$?
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (exit $got)"; else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

# 1. runtime env set → available (authoritative, even with no settings file)
chk "runtime env set -> 0" 0 env CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 HOME="$tmp" sh "$SCRIPT"

# 2. runtime unset, settings file absent → unavailable
rm -f "$tmp/.claude/settings.json"
chk "unset + no settings -> 1" 1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS HOME="$tmp" sh "$SCRIPT"

# 3. runtime unset, but declared in settings.json → available (no false-negative)
printf '{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }\n' > "$tmp/.claude/settings.json"
chk "unset + in settings -> 0" 0 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS HOME="$tmp" sh "$SCRIPT"

# 4. runtime unset, settings present but WITHOUT the var → unavailable
printf '{ "env": { "SOMETHING_ELSE": "1" } }\n' > "$tmp/.claude/settings.json"
chk "unset + settings w/o var -> 1" 1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS HOME="$tmp" sh "$SCRIPT"

[ "$fail" = 0 ] && echo "test-check-agent-teams.sh: PASS" || { echo "test-check-agent-teams.sh: FAIL" >&2; exit 1; }
