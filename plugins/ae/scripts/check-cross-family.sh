#!/bin/bash
# Check cross-family availability at session start.
#
# Registered via plugin.json `hooks.SessionStart`. BL-023 closure empirically verified
# 2026-05-20 (T1 ship: plugin.json hooks block auto-registers and fires on SessionStart).
# See `docs/references/cc-plugin-contract.md` BL-023 closure evidence.
#
# It is driven by the `cross_family` table and by each seat's own declared probe, so adding a
# family — or a whole new seat — does not edit this file. The previous version carried one
# hardcoded block per transport (a Node check, a binary check, a bundle-and-key check), which
# is the concrete extension cost F-082 set out to remove: the fourth family would have meant a
# fourth block here.
#
# A seat declares its probe in its own frontmatter:
#     probe: command -v codex >/dev/null 2>&1
# The probe runs with AE_ENDPOINT / AE_MODEL / AE_FAMILY set from the entry, and
# AE_PLUGIN_ROOT pointing at the plugin. It is repo-controlled text executed by a
# repo-controlled hook — the same trust level as the rest of this script.
#
# Never fatal: this reports to stderr and exits 0. A session must start even with no backend.

set -u

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
AE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SELF_DIR/.." && pwd)}"
REPO="$(cd "$SELF_DIR/../../.." && pwd)"
PIPELINE="${AE_PIPELINE:-$REPO/.claude/pipeline.yml}"
AGENTS="$AE_PLUGIN_ROOT/agents/workflow"
READER="$SELF_DIR/read-family-table.py"
export AE_PLUGIN_ROOT

ISSUES=()

# A probe is author-supplied text, so its own timeout is author-supplied too — and a probe that
# forgets one blocks SessionStart with nothing to stop it. `timeout(1)` is not present on a
# stock macOS, so the ceiling is enforced here with a watchdog rather than assumed.
PROBE_LIMIT_S="${AE_PROBE_TIMEOUT_S:-8}"
run_probe() { # $1 = probe string; returns probe's status, or 124 if it hit the ceiling
  bash -c "$1" >/dev/null 2>&1 &
  local pid=$! rc=0
  ( sleep "$PROBE_LIMIT_S"; kill -TERM "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  local wd=$!
  wait "$pid" 2>/dev/null || rc=$?
  if kill -0 "$wd" 2>/dev/null; then kill -TERM "$wd" 2>/dev/null; else rc=124; fi
  wait "$wd" 2>/dev/null
  return "$rc"
}

# Agent Teams flag — not family-specific, so it stays here.
SETTINGS_FILE="$HOME/.claude/settings.json"
AGENT_TEAMS=false
if [ -f "$SETTINGS_FILE" ]; then
  if command -v jq &>/dev/null; then
    [ -n "$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // empty' "$SETTINGS_FILE" 2>/dev/null)" ] && AGENT_TEAMS=true
  elif grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' "$SETTINGS_FILE" 2>/dev/null; then
    AGENT_TEAMS=true
  fi
fi
[ "$AGENT_TEAMS" = false ] && ISSUES+=("Agent Teams not enabled — most ae commands require it. Add to ~/.claude/settings.json: { \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }")

if [ -f "$PIPELINE" ] && [ -f "$READER" ] && command -v python3 &>/dev/null; then
  entries="$(python3 "$READER" "$PIPELINE" --enabled-only 2>/dev/null)"
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    eval "$(printf '%s' "$e" | python3 -c '
import json,sys,shlex
d=json.load(sys.stdin)
for k in ("label","seat","family","endpoint","model"):
    print("entry_%s=%s" % (k, shlex.quote(str(d.get(k,"")))))
')"
    def="$AGENTS/${entry_seat}-proxy.md"
    if [ ! -f "$def" ]; then
      ISSUES+=("$entry_label: no seat definition at $(basename "$def") — entry names a seat nothing implements")
      continue
    fi
    probe="$(sed -n '/^probe:[[:space:]]*/{s/^probe:[[:space:]]*//p;q;}' "$def")"
    if [ -z "$probe" ]; then
      ISSUES+=("$entry_label: seat '$entry_seat' declares no probe: line — its availability is unknown, which reads identically to available")
      continue
    fi
    export AE_ENDPOINT="$entry_endpoint" AE_MODEL="$entry_model" AE_FAMILY="$entry_family"
    if run_probe "$probe"; then :; else
      rc=$?
      if [ "$rc" -eq 124 ]; then
        ISSUES+=("$entry_label ($entry_family via $entry_seat): probe exceeded ${PROBE_LIMIT_S}s and was killed — a probe must bound its own wait; SessionStart cannot block on a backend")
      else
        ISSUES+=("$entry_label ($entry_family via $entry_seat): probe failed${entry_endpoint:+ — $entry_endpoint} — this family will report unavailable")
      fi
    fi
    unset AE_ENDPOINT AE_MODEL AE_FAMILY
  done <<EOF
$entries
EOF
else
  ISSUES+=("cross_family table not readable ($PIPELINE) — no family availability was checked")
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
  for issue in "${ISSUES[@]}"; do echo "[ae] WARNING: $issue" >&2; done
fi

# Cleanup orphan lockdirs from prior SIGKILL'd hook executions. 5min stale threshold —
# write-trace.sh's critical section is < 1s; anything older is an orphan.
if [ -d "$HOME/.ae/traces" ]; then
  find "$HOME/.ae/traces" -maxdepth 1 -name '*.lockdir' -type d -mmin +5 -exec rmdir {} \; 2>/dev/null
fi

exit 0
