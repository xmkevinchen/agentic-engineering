#!/bin/bash
# check-family-reachability.sh — can a skill select this family without a human naming it?
#
# The criterion: a family is *added* when a skill selects it on its own. Not when its files
# exist. The distinction matters because "adding a family touched zero skill files" is produced
# both by a mechanism general enough not to need editing AND by an orphan nothing points at,
# and a file count cannot tell those apart.
#
# It iterates **configured entries in `cross_family`**, not `*-proxy.md` files. Under the seat
# model several families share one seat, so a family that correctly has no definition of its
# own must not score zero for lacking one — and a definition with no entry is exactly the
# orphan this check exists to surface.
#
# HONEST SCOPE: passing every check here is NECESSARY, not SUFFICIENT. The criterion's real
# evidence is a run — the harness's subagent transcript showing the seat spawned by a skill and
# a backend tool called, with the family name absent from the prompt. This script cannot
# observe that. It reports which families are structurally capable of being selected.
#
# Exit 0 = every enabled entry met every precondition. Exit 1 = at least one gap. (Earlier
# versions always exited 0; the reachability test now consumes the status, so it gates.)

set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
AGENTS="$REPO/plugins/ae/agents/workflow"
PIPELINE="${AE_PIPELINE:-$REPO/.claude/pipeline.yml}"
MCP_JSON="$REPO/plugins/ae/.mcp.json"
SELECTION="$REPO/plugins/ae/skills/agent-selection/SKILL.md"
READER="$(dirname "$0")/read-family-table.py"

pass=0; fail=0
report() { # status label check detail
  if [ "$1" = ok ]; then pass=$((pass+1)); printf '  ok    %-12s %s\n' "$2" "$3"
  else fail=$((fail+1)); printf '  MISS  %-12s %s — %s\n' "$2" "$3" "$4"; fi
}

entries="$(python3 "$READER" "$PIPELINE" --enabled-only)"
if [ -z "$entries" ]; then
  echo "[reachability] no enabled entries in cross_family ($PIPELINE)"
  exit 1
fi

echo "[reachability] configured families in $PIPELINE"
echo

field() { printf '%s' "$1" | python3 -c "import json,sys; print(json.load(sys.stdin).get(sys.argv[1],''))" "$2"; }

while IFS= read -r e; do
  [ -n "$e" ] || continue
  label="$(field "$e" label)"
  seat="$(field "$e" seat)"
  family="$(field "$e" family)"
  legacy="$(field "$e" legacy)"

  echo "$label (seat: $seat, family: ${family:-<unset>})"

  [ "$legacy" = "True" ] && report miss "$label" "declared in table form" \
    "still a bare boolean; a boolean cannot carry seat, family or endpoint, so this entry cannot describe anything but itself"

  # 1. The seat it names has a definition.
  def="$AGENTS/${seat}-proxy.md"
  if [ -f "$def" ]; then
    report ok "$label" "seat definition exists ($(basename "$def"))"
  else
    report miss "$label" "seat definition exists" "no $(basename "$def") under agents/workflow — the entry names a seat nothing implements"
  fi

  # 2. Every MCP tool that seat declares is registered under that name. Catches the
  #    underscore/hyphen class: a definition can declare tools that do not exist, and the
  #    agent then runs with no backend and no error.
  if [ -f "$def" ]; then
    declared="$(grep -m1 '^tools:' "$def" | tr ',' '\n' | grep -o 'mcp__[A-Za-z0-9_-]*' | sort -u)"
    if [ -z "$declared" ]; then
      report miss "$label" "seat declares MCP tools" "no mcp__ tools on its tools: line"
    else
      missing=""
      for tool in $declared; do
        srv="$(printf '%s' "$tool" | sed 's/^mcp__plugin_ae_//; s/__.*$//')"
        grep -q "\"$srv\"" "$MCP_JSON" 2>/dev/null || missing="$missing $srv"
      done
      if [ -z "$missing" ]; then report ok "$label" "declared tools match a registered server"
      else report miss "$label" "declared tools match a registered server" \
        "no server named:$missing in .mcp.json — the agent would hold no backend"; fi
    fi
  fi

  # 3. The seat is named where skills delegate roster decisions.
  if grep -q "${seat}-proxy" "$SELECTION" 2>/dev/null; then
    report ok "$label" "seat named in agent-selection"
  else
    report miss "$label" "seat named in agent-selection" \
      "skills delegate roster decisions there; an unnamed seat is never offered a slot"
  fi

  # 4. The entry carries what its seat needs to reach a backend — and the SEAT says what that
  #    is, in its own `requires:` line. An earlier version hardcoded `case "$seat" in
  #    openai-compat) ...; *) report ok` here, which meant every seat but one was certified
  #    complete without checking anything: a genuinely new seat shape would have passed this
  #    gate while being unreachable. Silence is not consent — a seat with no `requires:` line
  #    is a miss, not a free pass.
  if [ -f "$def" ]; then
    if ! grep -q '^requires:' "$def"; then
      report miss "$label" "seat declares its required entry fields" \
        "$(basename "$def") has no requires: line — this check cannot tell a complete entry from an empty one, and would certify either"
    else
      needed="$(sed -n 's/^requires:[[:space:]]*//p' "$def" | head -1 | tr ',' ' ')"
      miss_f=""
      for f_name in $needed; do
        [ -n "$(field "$e" "$f_name")" ] || miss_f="$miss_f $f_name"
      done
      if [ -z "$miss_f" ]; then
        report ok "$label" "entry supplies what seat '$seat' requires (${needed:-nothing})"
      else
        report miss "$label" "entry supplies what seat '$seat' requires" \
          "missing:$miss_f — without them the call has no backend to reach"
      fi
    fi
  fi

  # 5. Lineage is declared, because coverage counts families and cannot infer one from a label.
  if [ -n "$family" ]; then
    report ok "$label" "family (lineage) declared"
  else
    report miss "$label" "family (lineage) declared" \
      "coverage counts distinct lineages; an entry without one cannot be counted honestly (BL-208)"
  fi
  echo
done <<EOF
$entries
EOF

# ---- table-level checks -----------------------------------------------------
dupes="$(printf '%s\n' "$entries" | python3 -c '
import json,sys,collections
c=collections.Counter()
labels=collections.defaultdict(list)
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    d=json.loads(line); f=d.get("family","")
    if f: c[f]+=1; labels[f].append(d["label"])
for f,n in c.items():
    if n>1: print(f + ": " + ", ".join(labels[f]))
')"
if [ -n "$dupes" ]; then
  echo "[reachability] shared lineages — these count ONCE toward coverage, not once each (BL-208):"
  printf '%s\n' "$dupes" | sed 's/^/    /'
  echo
fi

keyed="$(printf '%s\n' "$entries" | python3 -c '
import json,sys
n=[json.loads(l)["label"] for l in sys.stdin if l.strip() and json.loads(l).get("api_key_env")]
print(" ".join(n))
')"
n_keyed="$(printf '%s' "$keyed" | wc -w | tr -d ' ')"
if [ "$n_keyed" -gt 1 ]; then
  echo "[reachability] FAIL-CLOSED: $n_keyed entries declare api_key_env ($keyed)." >&2
  echo "               The bridge holds one key for every endpoint (BL-214), so a second keyed" >&2
  echo "               backend would receive the first one's credential. Configure one, or close" >&2
  echo "               BL-214 first." >&2
  fail=$((fail+1))
fi

echo "[reachability] $pass precondition(s) met, $fail missed"
if [ "$fail" -gt 0 ]; then
  echo "[reachability] a missed precondition means a skill cannot choose that family on its"
  echo "               own — it can still be spawned by naming it explicitly, which is what"
  echo "               makes the gap invisible in normal use."
  exit 1
fi
exit 0
