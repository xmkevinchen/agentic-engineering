#!/bin/sh
# check-agent-teams.sh — canonical Agent Teams availability check.
# Replaces the per-skill LLM-improvised "read settings.json + check the env var"
# prose, which could false-negative (a misfiring grep) and wrongly degrade a whole
# pipeline to solo — silently dropping cross-family / parallel review / Doodlestein.
# A deterministic fact belongs in a deterministic check, not an eyeballed grep.
#
# Available iff the runtime env var is set (the source of truth — Claude Code loads
# settings.json `env` into the process at startup) OR it is declared in
# ~/.claude/settings.json `.env` (covers any runtime that doesn't re-export it).
#
#   exit 0 = Agent Teams available
#   exit 1 = unavailable (prints the actionable reason to stderr)
if [ -n "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" ]; then
  exit 0
fi
SETTINGS="${HOME}/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  if command -v jq >/dev/null 2>&1; then
    [ -n "$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // empty' "$SETTINGS" 2>/dev/null)" ] && exit 0
  elif grep -q '"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"' "$SETTINGS" 2>/dev/null; then
    exit 0
  fi
fi
echo "[ae] Agent Teams not enabled. Add to ~/.claude/settings.json: { \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } } and restart Claude Code." >&2
exit 1
