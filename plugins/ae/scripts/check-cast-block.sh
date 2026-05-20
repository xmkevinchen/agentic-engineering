#!/bin/sh
# check-cast-block.sh — Plan 055 Step 2: CI grep for Agent() spawn prompts missing Cast block
#
# v0.10.x schema grep script; v0.11.x candidate to upgrade to schema validator framework.
# Closes BL-079 (cast-block spec drift detection automation).
#
# Behavior:
# - Scan plugins/ae/skills/*/SKILL.md (skill definitions only; not docs/ not tests/)
# - For each Agent(subagent_type=...) spawn call, look at next 30 lines for 4 Cast fields
# - Required markers: "📋 Cast:" + "Role:" + "Angle:" + "Why:" (verbatim, prefix-anywhere on line)
# - If all 4 found within window → PASS
# - If any missing → FAIL (report file:line of the Agent() call + which markers missing)
# - Exit 0 = all spawn calls conform / Exit 1 = any spawn missing Cast block

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS_DIR="$REPO_ROOT/plugins/ae/skills"
WINDOW=30  # lines after Agent() to search for Cast markers

# Scope LOCK per Plan 055 architect C1: only plugins/ae/skills/*/SKILL.md
# docs/ and tests/ excluded by directory scope (find -path)

[ -d "$SKILLS_DIR" ] || { echo "[check-cast-block] error: skills dir not found at $SKILLS_DIR" >&2; exit 1; }

failures=0
total_agent_calls=0
total_skills_scanned=0

for skill_file in $(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' 2>/dev/null); do
  total_skills_scanned=$((total_skills_scanned + 1))
  relpath="${skill_file#$REPO_ROOT/}"

  # Find all line numbers containing Agent(subagent_type
  agent_lines=$(grep -nE '^[[:space:]]*Agent\(subagent_type' "$skill_file" | cut -d: -f1)

  for line_num in $agent_lines; do
    total_agent_calls=$((total_agent_calls + 1))
    window_end=$((line_num + WINDOW))

    # Extract window
    window_content=$(sed -n "${line_num},${window_end}p" "$skill_file")

    # Check 4 markers
    missing=""
    echo "$window_content" | grep -qF '📋 Cast:' || missing="$missing 📋Cast:"
    echo "$window_content" | grep -qE '^[[:space:]]+Role:' || missing="$missing Role:"
    echo "$window_content" | grep -qE '^[[:space:]]+Angle:' || missing="$missing Angle:"
    echo "$window_content" | grep -qE '^[[:space:]]+Why:' || missing="$missing Why:"

    if [ -n "$missing" ]; then
      echo "[check-cast-block] FAIL: $relpath:$line_num spawn missing Cast markers:$missing" >&2
      failures=$((failures + 1))
    fi
  done
done

echo "[check-cast-block] scanned=$total_skills_scanned SKILL.md files, agent_calls=$total_agent_calls failures=$failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
