#!/bin/bash
# Check cross-family MCP availability and dependencies at session start
# Results written to .claude/cross-family-status.json

STATUS_FILE=".claude/cross-family-status.json"
mkdir -p .claude

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

# Build issues JSON array
ISSUES_JSON="[]"
if [ ${#ISSUES[@]} -gt 0 ]; then
  ISSUES_JSON="["
  for i in "${!ISSUES[@]}"; do
    [ $i -gt 0 ] && ISSUES_JSON+=","
    ISSUES_JSON+="\"${ISSUES[$i]}\""
  done
  ISSUES_JSON+="]"
fi

cat > "$STATUS_FILE" <<EOF
{
  "agent_teams": $AGENT_TEAMS,
  "node": $NODE_AVAILABLE,
  "codex": $CODEX_AVAILABLE,
  "gemini": $GEMINI_AVAILABLE,
  "issues": $ISSUES_JSON,
  "checked_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
