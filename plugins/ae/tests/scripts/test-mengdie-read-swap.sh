#!/bin/sh
# AC2 (F-070 Step 1): 5 read sites wired to the graph, none half-swapped.
# sh-tap output (parser: sh-tap.v1). Structural wiring grep (F-067 lesson):
# each Prior-Context section must carry ALL THREE mechanism tokens
# (.ae/graph + graph-index-gen.py + graph-neighbors.py) — an index read without
# regen/traversal is a half-swap and must fail (codex plan-review).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILLS="$REPO/plugins/ae/skills"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# extract the Prior-Context section of a skill (heading → next ## or ### heading)
section(){ # $1 = skill file
  awk '/^#+ .*Prior [Cc]ontext/{p=1; print; next} p && /^#+ /{exit} p' "$1"
}

for skill in discuss think plan review plugin-stats; do
  f="$SKILLS/$skill/SKILL.md"
  sec=$(section "$f")
  if [ -z "$sec" ]; then
    notok "$skill: Prior-Context section exists"
    continue
  fi
  ok "$skill: Prior-Context section exists"
  case "$sec" in *".ae/graph"*) ok "$skill: reads the layered index (.ae/graph)";; *) notok "$skill: reads the layered index (.ae/graph)";; esac
  case "$sec" in *graph-index-gen.py*) ok "$skill: regenerates the index (graph-index-gen.py)";; *) notok "$skill: regenerates the index (graph-index-gen.py)";; esac
  case "$sec" in *graph-neighbors.py*) ok "$skill: traverses edges (graph-neighbors.py)";; *) notok "$skill: traverses edges (graph-neighbors.py)";; esac
  case "$sec" in *memory_search*) notok "$skill: no memory_search remains in the section";; *) ok "$skill: no memory_search remains in the section";; esac
  case "$sec" in *"## Prior Art from Project Knowledge Base"*) ok "$skill: render heading preserved";; *) notok "$skill: render heading preserved";; esac
done

# review:263 bundle-hierarchy paragraph: graph wording, hierarchy rule survives
if rg -q 'Mengdie results' "$SKILLS/review/SKILL.md"; then
  notok "review bundle-interaction paragraph no longer says 'Mengdie results'"
else
  ok "review bundle-interaction paragraph no longer says 'Mengdie results'"
fi
if rg -q 'advisory background' "$SKILLS/review/SKILL.md"; then
  ok "review bundle hierarchy rule (primary vs advisory background) survives"
else
  notok "review bundle hierarchy rule (primary vs advisory background) survives"
fi

# plugin-stats honesty: the degradation from outcome-trends must be named
sec=$(section "$SKILLS/plugin-stats/SKILL.md")
case "$sec" in
  *"not"*"outcome"*|*"NOT"*"outcome"*) ok "plugin-stats names the outcome-trends degradation honestly";;
  *) notok "plugin-stats names the outcome-trends degradation honestly";;
esac

# analyze: canonical long form untouched and still wired
sec=$(section "$SKILLS/analyze/SKILL.md")
case "$sec" in
  *graph-neighbors.py*) ok "analyze canonical locate-step still wired";;
  *) notok "analyze canonical locate-step still wired";;
esac

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
