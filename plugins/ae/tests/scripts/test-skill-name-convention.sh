#!/bin/sh
# An agent's `skills:` frontmatter value is a catalog key into the skill registry, and its
# documented form is `<plugin>:<skill>`. Both failure shapes are silent — the host skips an
# entry it cannot resolve and logs only under --debug — so neither shows up as an error:
#
#   1. the namespace stripped (`agent-teams`), which no longer matches any key;
#   2. the namespace intact but the skill gone (`ae:agent-teams` after the skill is removed).
#
# No agent declares the field today. That is why the guard below plants both shapes in a
# throwaway tree: an assertion that only ever runs against an empty population cannot show it
# would catch anything.
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# Every declared value is `ae:<skill>` AND that skill exists.
check_tree(){ # $1 = agents root, $2 = skills root, $3 = label; echoes offending values
  grep -rh '^skills:' "$1" 2>/dev/null | sed 's/^skills: *//' | tr ',' '\n' | while read -r v; do
    v=$(echo "$v" | sed 's/^ *//;s/ *$//')
    [ -n "$v" ] || continue
    case "$v" in
      ae:*) [ -f "$2/${v#ae:}/SKILL.md" ] || echo "$v" ;;
      *)    echo "$v" ;;
    esac
  done
}

bad=$(check_tree "$REPO/plugins/ae/agents" "$SKILLS")
if [ -z "$bad" ]; then
  ok "every agent skills: value is qualified and resolves"
else
  notok "unresolvable agent skills: values: $(echo "$bad" | tr '\n' ' ')"
fi

# --- mutation guard ----------------------------------------------------------
tmp=$(mktemp -d)
mkdir -p "$tmp/agents" "$tmp/skills/plan"
: > "$tmp/skills/plan/SKILL.md"

printf -- '---\nname: a\nskills: plan\n---\n' > "$tmp/agents/stripped.md"
[ -n "$(check_tree "$tmp/agents" "$tmp/skills")" ] \
  && ok "guard catches a stripped namespace" || notok "guard catches a stripped namespace"
rm "$tmp/agents/stripped.md"

printf -- '---\nname: a\nskills: ae:gone\n---\n' > "$tmp/agents/dangling.md"
[ -n "$(check_tree "$tmp/agents" "$tmp/skills")" ] \
  && ok "guard catches a namespace pointing at a removed skill" || notok "guard catches a namespace pointing at a removed skill"
rm "$tmp/agents/dangling.md"

printf -- '---\nname: a\nskills: ae:plan\n---\n' > "$tmp/agents/good.md"
[ -z "$(check_tree "$tmp/agents" "$tmp/skills")" ] \
  && ok "guard accepts a value that resolves" || notok "guard accepts a value that resolves"

rm -rf "$tmp"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
