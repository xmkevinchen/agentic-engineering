#!/bin/sh
# check-proxy-residual.sh — what is left in a proxy definition once shared policy is cited
# rather than copied.
#
# This is the measuring instrument for F-082's trim. The trim is an experiment, not a
# cleanup: three candidate end-shapes for the per-family definition predict three different
# residuals, so the residual has to be measured before the shape is chosen.
#
# HONEST SCOPE — read this before trusting a green exit:
#
#   Duplication here means COPIED WORDING — a contiguous run of >= 8 normalised words
#   present in both a proxy and a canonical reference (see proxy-dup-sentences.py, which
#   does that comparison and documents why line- and sentence-granularity both failed).
#   Policy restated in genuinely different words is semantic duplication and this check
#   CANNOT detect it. Catching that is the judge's job, against the negative claim the
#   trim record is required to write down for every residual item ("this is not a
#   paraphrase of <canonical passage>"). A green exit means no copied wording remains.
#   It does not mean no duplicated policy remains.
#
# Baseline: captured by this script, never quoted. On first run it snapshots the current
# definitions into <feature-dir>/trim-baseline/ and reports a zero reduction against
# itself. Every later run compares the live files against that snapshot.
#
# Exit 0 = all assertions pass. Exit 1 = at least one failed.

set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
AGENTS="$REPO/plugins/ae/agents/workflow"
FEATURE="$REPO/.ae/features/active/F-082-agent-orchestration-conventions"
BASELINE="$FEATURE/trim-baseline"
RECORD="$FEATURE/trim-residual.md"

# Canonical shared references — a line living here is policy the proxies should cite.
CANON="$REPO/plugins/ae/skills/agent-teams/SKILL.md $REPO/plugins/ae/skills/agent-selection/SKILL.md"

MIN_LEN=40          # shorter lines carry too little signal to call duplication
fail=0

# Sections whose canonical home is now `agent-teams` § Teammate boundaries. A proxy may CITE
# them; it may not carry them as its own heading. This assertion exists because the
# normalised-line check above cannot see the case it was meant to catch: moving policy to a
# shared home usually means generalising its wording, after which the copy left behind no
# longer matches literally and the line check passes vacuously. The heading is structural,
# survives rewording, and is what "cite instead of copying" actually means.
MOVED_SECTIONS='Role boundary
Tool routing
Graceful degradation
Team Communication Protocol'

note() { printf '  %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1" >&2; fail=1; }

# normalise: strip list markers / headings / emphasis / backticks, fold family nouns,
# collapse whitespace, lowercase. Same filter on both sides of the comparison.
normalise() {
  sed -e 's/^[[:space:]]*[-*+][[:space:]]*//' \
      -e 's/^[[:space:]]*#\{1,6\}[[:space:]]*//' \
      -e 's/[*`_]//g' \
      -e 's/[[:space:]]\{1,\}/ /g' \
      -e 's/^ //; s/ $//' \
  | tr '[:upper:]' '[:lower:]' \
  | sed -e "s/$FAMILY_NOUNS/<family>/g"
}

# Family nouns to fold before comparing. The seat names are derived from the proxy filenames
# so adding a family does not require editing this script; only weight-lineage nouns, which no
# filename carries, are listed literally.
family_nouns() {
  seats="$(find "$AGENTS" -maxdepth 1 -name '*-proxy.md' -exec basename {} .md \; \
           | sed 's/-proxy$//' | tr '[:upper:]' '[:lower:]')"
  printf '%s\n' $seats openai google anthropic claude qwen llama gemma deepseek mistral \
    | sort -u | paste -sd'|' - | sed 's/|/\\|/g'
}

proxies() { find "$AGENTS" -maxdepth 1 -name '*-proxy.md' | sort; }

FAMILY_NOUNS="$(family_nouns)"

# ---- baseline snapshot ------------------------------------------------------
first_run=0
if [ ! -d "$BASELINE" ]; then
  mkdir -p "$BASELINE" || exit 1
  for p in $(proxies); do cp "$p" "$BASELINE/$(basename "$p")"; done
  first_run=1
  echo "[residual] baseline captured: $BASELINE (first run — reduction measured against it from now on)"
fi

# ---- canonical line set -----------------------------------------------------
canon_norm="$(mktemp)"; trap 'rm -f "$canon_norm" "$tmp_lines" 2>/dev/null' EXIT
for f in $CANON; do
  [ -f "$f" ] && cat "$f"
done | normalise | awk -v n="$MIN_LEN" 'length($0) >= n' | sort -u > "$canon_norm"

echo "[residual] canonical corpus: $(wc -l < "$canon_norm" | tr -d ' ') distinct normalised lines"
echo

# ---- per-proxy report -------------------------------------------------------
total_now=0; total_base=0; dup_total=0
tmp_lines="$(mktemp)"

printf '%-18s %7s %7s %7s %9s %s\n' proxy lines nonblank copied baseline toolsearch
for p in $(proxies); do
  base="$(basename "$p")"
  n_lines=$(wc -l < "$p" | tr -d ' ')
  n_nb=$(grep -c '[^[:space:]]' "$p")
  b_lines=0
  [ -f "$BASELINE/$base" ] && b_lines=$(wc -l < "$BASELINE/$base" | tr -d ' ')

  dup_report=$(python3 "$(dirname "$0")/proxy-dup-sentences.py" "$p" $CANON)
  dup=$(printf '%s' "$dup_report" | grep -c . )

  # The trigger has to be executable, not merely mentioned. A passing comment containing the
  # word "ToolSearch" satisfies a string match and teaches the agent nothing: it needs the
  # `select:` query naming this backend's tools, and a stop-on-failure instruction next to it,
  # or the BL-212 path stays open with the check green.
  ts=no
  if grep -q 'ToolSearch(query: *"select:mcp__' "$p"; then
    ts_line=$(grep -n 'ToolSearch(query: *"select:mcp__' "$p" | head -1 | cut -d: -f1)
    if sed -n "$((ts_line)),$((ts_line + 12))p" "$p" | grep -qi 'unavailable\|report and stop\|STOP'; then
      ts=yes
    else
      ts=partial
    fi
  fi

  printf '%-18s %7s %7s %7s %9s %s\n' "$base" "$n_lines" "$n_nb" "$dup" "$b_lines" "$ts"

  total_now=$((total_now + n_lines))
  total_base=$((total_base + b_lines))
  dup_total=$((dup_total + dup))

  [ "$dup" -eq 0 ] || bad "$base carries $dup copied span(s) from a canonical shared reference — cite instead of copying:
$(printf '%s\n' "$dup_report" | sed 's/^/          /')"
  # no pipe into the loop — a subshell would swallow the fail flag
  OLDIFS="$IFS"; IFS='
'
  for sec in $MOVED_SECTIONS; do
    [ -n "$sec" ] || continue
    grep -qi "^#\{1,6\}[[:space:]].*${sec}" "$p" \
      && bad "$base still carries a \"$sec\" heading — that policy is canonical in agent-teams § Teammate boundaries; cite it"
  done
  IFS="$OLDIFS"

  # Every mcp__ tool named anywhere in the body must be one the frontmatter declares. A
  # worked example calling a tool the agent never held is indistinguishable, to the agent,
  # from a correct one — it follows the example and gets tool-not-found on its first backend
  # call. The underscore-vs-hyphen form of this was live in openai-compat-proxy.md's invocation block
  # while check-family-reachability.sh scored that same file "declared tools match a registered
  # server" — that check only ever reads the frontmatter line (F-082).
  declared_tools="$(grep -m1 '^tools:' "$p" | grep -o 'mcp__[A-Za-z0-9_-]*' | sort -u)"
  body_tools="$(sed '1,/^---$/d; 1,/^---$/d' "$p" | grep -o 'mcp__[A-Za-z0-9_-]*' | sort -u)"
  for t in $body_tools; do
    printf '%s\n' $declared_tools | grep -qx "$t" \
      || bad "$base body calls '$t' which its frontmatter tools: line does not declare — an agent following that example gets tool-not-found on its first backend call"
  done

  # A citation is not a load. Measured 2026-08-16 with a probe agent whose frontmatter declares
  # `skills: ae:agent-teams`: it received a one-line listing entry, not the skill body, and
  # could not quote any heading from it. So a proxy that merely links the canonical section is
  # relying on text that is not in its context — the link must come with an instruction to
  # actually read it.
  grep -qi 'read that section before you act' "$p" \
    || bad "$base links the canonical section but never tells the agent to read it — the skill body is not loaded into an agent's context by declaring or linking it, so an unread citation binds nothing"

  case "$ts" in
    yes) : ;;
    partial) bad "$base has a ToolSearch select: query but no stop-on-failure instruction within 12 lines of it — a fetch that fails silently leaves the agent proceeding with no backend (BL-212)" ;;
    *)  bad "$base has no executable ToolSearch trigger — needs ToolSearch(query: \"select:mcp__…\") naming its own backend tools, as its first action (BL-212). A prose mention does not count." ;;
  esac
done

echo
echo "[residual] total lines now: $total_now   baseline: $total_base   copied-policy lines: $dup_total"

# ---- assertions -------------------------------------------------------------
if [ "$first_run" -eq 1 ]; then
  note "first run — reduction not asserted (baseline is this same state)"
elif [ "$total_now" -lt "$total_base" ]; then
  note "reduction: $((total_base - total_now)) line(s) below baseline"
else
  bad "total lines ($total_now) is not below the captured baseline ($total_base)"
fi

if [ -f "$RECORD" ]; then
  # The record must state the same numbers this run measured, or it is a narrative.
  grep -q "measured-total: $total_now" "$RECORD" \
    || bad "$(basename "$RECORD") does not carry 'measured-total: $total_now' — the recorded residual must match what this script measures, in the same run"
  grep -q 'not a paraphrase of' "$RECORD" \
    || bad "$(basename "$RECORD") records no negative paraphrase claims — every residual item must name the canonical passage it is NOT a rewording of, since this script cannot see paraphrase"
else
  [ "$first_run" -eq 1 ] || bad "$RECORD missing — the classification, not just the count, is the deliverable"
fi

echo
if [ "$fail" -eq 0 ]; then echo "[residual] PASS"; else echo "[residual] FAIL"; fi
exit "$fail"
