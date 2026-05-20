#!/bin/bash
# Check cross-family MCP availability and dependencies at session start
#
# NOTE (BL-023): hooks.json is NOT auto-registered by the Claude Code plugin system.
# This script runs only if manually wired into ~/.claude/settings.json SessionStart hooks.
# The cross-family-status.json output was never consumed by any skill; removed to avoid
# dead writes. Check logic and stderr warnings preserved for future use.

AGENT_TEAMS=false
CODEX_AVAILABLE=false
GEMINI_AVAILABLE=false
NODE_AVAILABLE=false
ISSUES=()

# Check Agent Teams experimental flag
SETTINGS_FILE="$HOME/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  if command -v jq &>/dev/null; then
    AT=$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // empty' "$SETTINGS_FILE" 2>/dev/null)
    if [ -n "$AT" ]; then
      AGENT_TEAMS=true
    fi
  else
    # Fallback: grep for the key
    if grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' "$SETTINGS_FILE" 2>/dev/null; then
      AGENT_TEAMS=true
    fi
  fi
fi

if [ "$AGENT_TEAMS" = false ]; then
  ISSUES+=("Agent Teams not enabled — most ae commands require it. Add to ~/.claude/settings.json: { \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }")
fi

# Check node
if command -v node &>/dev/null; then
  NODE_AVAILABLE=true
  NODE_VERSION=$(node --version 2>/dev/null)
else
  ISSUES+=("node not found — gemini MCP server requires Node.js")
fi

# Check codex
if command -v codex &>/dev/null; then
  CODEX_AVAILABLE=true
else
  ISSUES+=("codex CLI not found — install with: npm install -g @openai/codex")
fi

# Check gemini
if [ "$NODE_AVAILABLE" = true ]; then
  GEMINI_SERVER="${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini/dist/index.js"
  if [ -f "$GEMINI_SERVER" ]; then
    if [ -n "$GEMINI_API_KEY" ] || [ -f "$HOME/.config/gemini/credentials.json" ]; then
      GEMINI_AVAILABLE=true
    else
      ISSUES+=("gemini: no API key or credentials found — set GEMINI_API_KEY or run 'gemini auth'")
    fi
  else
    ISSUES+=("gemini: server not built — run 'cd ${CLAUDE_PLUGIN_ROOT}/mcp-servers/gemini && npm run build'")
  fi
fi

# Print issues to stderr (visible in session output if hook is ever wired up)
if [ ${#ISSUES[@]} -gt 0 ]; then
  for issue in "${ISSUES[@]}"; do
    echo "[ae] WARNING: $issue" >&2
  done
fi

# Plan 054 Step 1 BL-023 smoke test debug log: removed after AC1 verified
# (entry ts=2026-05-20T21:45:15Z confirmed hook fires + CLAUDE_CODE_SESSION_ID exposed).
# Per architecture-reviewer + security-reviewer findings on /ae:review: indefinite
# /tmp/ae-session-check.log accumulation + session id leak risk → remove.

# Plan 054 review findings: cleanup orphan ~/.ae/traces/*.lockdir from prior SIGKILL'd
# hook executions (gemini-proxy MF#1 reclassified). 5min stale threshold — write-trace.sh
# critical section is < 1s; anything older is orphan.
if [ -d "$HOME/.ae/traces" ]; then
  find "$HOME/.ae/traces" -maxdepth 1 -name '*.lockdir' -type d -mmin +5 -exec rmdir {} \; 2>/dev/null
fi
