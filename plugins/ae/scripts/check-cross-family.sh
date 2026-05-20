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

# BL-023 / Plan 054 Step 1 smoke test: log session ID env vars on every SessionStart.
# Verifies (a) plugin.json hooks block 是否真的被 CC 注册触发, (b) $CLAUDE_CODE_SESSION_ID
# 是否在 hook 执行 context 暴露 (T1 trace filename = session id 依赖此变量)。
# Output appended to /tmp/ae-session-check.log; user 验证后可删除该 log 与本段代码。
{
  echo "---"
  echo "ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "CLAUDE_CODE_SESSION_ID=${CLAUDE_CODE_SESSION_ID:-MISSING}"
  echo "CC_SESSION_ID=${CC_SESSION_ID:-MISSING}"
  echo "AE_SESSION_ID=${AE_SESSION_ID:-MISSING}"
  echo "agent_teams=$AGENT_TEAMS codex=$CODEX_AVAILABLE gemini=$GEMINI_AVAILABLE"
} >> /tmp/ae-session-check.log 2>/dev/null
