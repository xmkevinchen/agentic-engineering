#!/bin/sh
# The plugin namespace lives in exactly two shapes, and stripping it from
# SKILL.md `name:` frontmatter must not touch either one:
#
#   1. Agent frontmatter `skills:` values are catalog keys into the skill
#      registry, whose documented form is `<plugin>:<skill>`. Resolution
#      failure there is silent (the host skips the entry and logs only under
#      --debug), so a wrong strip is a no-signal regression.
#   2. Trace / writeback records carry `ae:<skill>` as AE's own log schema.
#      They record COMMAND identity — `/ae:work` stays `/ae:work` — and are
#      authored by convention, never read from frontmatter.
#
# Both look exactly like the frontmatter bug and neither is one. This guard
# exists so a bulk `ae:` sweep cannot quietly consume them.
# sh-tap output (parser: sh-tap.v1).
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

AGENTS="$REPO/plugins/ae/agents/workflow"
HEALTH="$REPO/plugins/ae/scripts/graph-writeback-health.py"
TRACE="$REPO/plugins/ae/scripts/append-synthesis-trace.sh"

# --- agent `skills:` references stay fully qualified -------------------------
# An exact file->value map, not just a count: a count alone passes if one
# agent loses the field while another grows it.
expect_skills(){ # $1 = agent basename, $2 = expected skills value
  f="$AGENTS/$1.md"
  if [ ! -f "$f" ]; then
    notok "$1.md exists"; return
  fi
  got=$(grep '^skills:' "$f" | head -1 | sed 's/^skills: *//')
  if [ "$got" = "$2" ]; then
    ok "$1 keeps qualified skills reference ($2)"
  else
    notok "$1 skills reference is '$got', expected '$2'"
  fi
}

expect_skills architect  "ae:agent-teams"
expect_skills challenger "ae:agent-teams"
expect_skills qa         "ae:code-review"
expect_skills test-lead  "ae:test-plugin"

# No OTHER workflow agent silently grows a `skills:` field: the four above are
# the whole population, so an unqualified fifth would slip past the map.
n=$(grep -l '^skills:' "$AGENTS"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$n" = "4" ]; then
  ok "exactly 4 workflow agents declare a skills: field"
else
  notok "expected 4 workflow agents with a skills: field, found $n"
fi

# --- trace / writeback schema literals survive -------------------------------
for s in ae:analyze ae:plan ae:discuss ae:review ae:think; do
  if grep -q "\"$s\"" "$HEALTH"; then
    ok "LOCATE_SKILLS still carries $s"
  else
    notok "LOCATE_SKILLS lost $s — writeback health would stop counting that skill's queries"
  fi
done

if grep -q '"skill":"ae:discuss"' "$TRACE"; then
  ok "synthesis trace still emits the ae:discuss command identity"
else
  notok "synthesis trace lost its ae:discuss literal"
fi

# --- mutation guard ----------------------------------------------------------
# The assertions above only ever run against a healthy tree, so on their own
# they cannot show they would catch anything. Plant each failure shape.
tmp=$(mktemp -d)

printf -- '---\nname: architect\nskills: agent-teams\n---\n' > "$tmp/architect.md"
got=$(grep '^skills:' "$tmp/architect.md" | head -1 | sed 's/^skills: *//')
if [ "$got" != "ae:agent-teams" ]; then
  ok "map check rejects a stripped skills value"
else
  notok "map check rejects a stripped skills value"
fi

printf 'LOCATE_SKILLS = {"analyze", "plan"}\n' > "$tmp/health.py"
if ! grep -q '"ae:analyze"' "$tmp/health.py"; then
  ok "literal check rejects a stripped LOCATE_SKILLS"
else
  notok "literal check rejects a stripped LOCATE_SKILLS"
fi

rm -rf "$tmp"

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
