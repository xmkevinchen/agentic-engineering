#!/bin/sh
# test-agent-name-collision.sh — agent-name collision lint (F-077).
#
# Agent names are the SendMessage(to:) address key (not display labels), so two
# live-or-resumable teammates sharing a bare name is an addressing hazard. This lint
# enforces the STATICALLY-checkable slice of the no-duplicate-live invariant:
#   (2a) intra-skill CONCRETE same-name spawn under >=2 distinct nearest-heading
#        blocks (placeholder `<...>` literals excluded) — UNLESS the skill carries a
#        `# name-reuse-safe: <name>` annotation (teardown-before-respawn guaranteed).
#   (2b) every discuss Round-0 (§1.5.1) spawn name ends in `-framing` — the real
#        collision (Round-0 concrete `codex-proxy` vs a Step-2 council `<proxy>`
#        resolved to `codex-proxy` at runtime) is invisible to (2a) because the
#        council side is a filtered placeholder; (2b) asserts the fix directly.
#
# NOT enforceable here (by design — a single-file static lint cannot see it): runtime
# placeholder-resolved collisions and cross-skill reuse timing. Those are handled by
# discuss's distinct Round-0 naming + agent-teams' teardown-ordering operator rule.
#
# Accepted limit: only spawns with `subagent_type:` and `name: "..."` on the SAME line
# are seen (the corpus convention). A hypothetical multi-line spawn would be missed.
set -u
HERE=$(dirname "$0")
ROOT=$(cd "$HERE/../../../.." && pwd)
fail=0

# Print "heading<TAB>name" for each CONCRETE spawn in one SKILL.md, keyed by the text
# of its nearest preceding markdown heading (flat — no inferred 1.5/1.5.1 hierarchy).
extract_spawns() {
  awk '
    /^#+[ \t]/ { h=$0; next }
    /subagent_type:/ && /name:[ ]*"/ {
      s=$0; sub(/.*name:[ ]*"/, "", s); sub(/".*/, "", s)
      if (s ~ /^<.*>$/) next          # drop placeholder <...> (runtime-resolved)
      print h "\t" s
    }' "$1"
}

# Print names spawned under >=2 distinct headings in one SKILL.md, minus exemptions.
file_2a_violations() {
  f=$1
  exempt=$(grep -oE '#[ ]*name-reuse-safe:[ ]*[A-Za-z0-9_-]+' "$f" 2>/dev/null | sed -E 's/.*:[ ]*//' | sort -u)
  extract_spawns "$f" | sort -u | awk -F'\t' '{c[$2]++} END{for(n in c) if(c[n]>1) print n}' \
    | while IFS= read -r n; do
        [ -n "$n" ] || continue
        printf '%s\n' "$exempt" | grep -qx "$n" && continue
        printf '%s\n' "$n"
      done
}

# (2a) live corpus — no un-annotated concrete same-name reuse across phase blocks
any_2a=0
for f in "$ROOT"/plugins/ae/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  v=$(file_2a_violations "$f")
  if [ -n "$v" ]; then
    skill=$(basename "$(dirname "$f")")
    echo "  FAIL[2a]: skill '$skill' reuses concrete spawn name(s) across phase blocks: $(echo "$v" | tr '\n' ' ')" >&2
    echo "           fix: suffix the names distinctly (e.g. -<phase>), OR add '# name-reuse-safe: <name>' if teardown-before-respawn is guaranteed." >&2
    fail=1; any_2a=1
  fi
done
[ "$any_2a" = 0 ] && echo "  ok[2a]: no un-annotated concrete same-name reuse across phase blocks"

# (2b) discuss Round-0 (§1.5.1): every spawn name ends in -framing — AND the check
# actually SAW the full panel. Without the count guard, a renumbered heading or a
# multi-line spawn would silently drop the match set to zero and false-green the exact
# invariant F-077 exists to protect (a check that can pass on zero is not enforcement).
MIN_ROUND0=5
check_2b() {   # $1=discuss SKILL.md → echoes "PASS <n>" or "FAIL <reason>"
  names=$(extract_spawns "$1" | awk -F'\t' '$1 ~ /1\.5\.1/ {print $2}')
  n=$(printf '%s' "$names" | grep -c .)
  bad=$(printf '%s\n' "$names" | awk 'NF && $0 !~ /-framing$/')
  if [ "$n" -lt "$MIN_ROUND0" ]; then
    echo "FAIL saw only $n Round-0 spawn(s) (expected >=$MIN_ROUND0) — §1.5.1 heading renumbered, a spawn removed/gone-multiline, or extraction broke; refusing to pass vacuously. If the Round-0 panel size intentionally changed, update MIN_ROUND0."
  elif [ -n "$bad" ]; then
    echo "FAIL Round-0 INSTANCE names must end in -framing (rename only the name:/Cast — the subagent_type and the agent-file path stay bare): $(echo "$bad" | tr '\n' ' ')"
  else
    echo "PASS $n"
  fi
}
df="$ROOT/plugins/ae/skills/discuss/SKILL.md"
if [ -f "$df" ]; then
  r2b=$(check_2b "$df")
  case "$r2b" in
    "PASS "*) echo "  ok[2b]: all ${r2b#PASS } discuss Round-0 spawn names end in -framing (panel count verified)";;
    "FAIL "*) echo "  FAIL[2b]: ${r2b#FAIL }" >&2; fail=1;;
  esac
fi

# Negative self-test — detector MUST fire on an injected CONCRETE cross-heading dup.
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/faketest"
printf '%s\n' \
  '## Phase A' \
  'Agent(subagent_type: "ae:workflow:challenger", name: "challenger",' \
  '      run_in_background: true, prompt: "x")' \
  '## Phase B' \
  'Agent(subagent_type: "ae:workflow:challenger", name: "challenger",' \
  '      run_in_background: true, prompt: "y")' > "$tmp/faketest/SKILL.md"
if [ -n "$(file_2a_violations "$tmp/faketest/SKILL.md")" ]; then
  echo "  ok[2a]: negative self-test — detector fires on injected concrete cross-heading duplicate"
else
  echo "  FAIL: 2a negative self-test — detector missed an injected duplicate" >&2; fail=1
fi

# 2b negative self-test (i): a bare Round-0 INSTANCE name under §1.5.1 must be caught.
mkdir -p "$tmp/disc_bad"
{ printf '%s\n' '#### 1.5.1. Spawn framing-review team'
  printf 'Agent(subagent_type: "x", name: "%s",\n' codex-proxy a2-framing a3-framing a4-framing a5-framing
} > "$tmp/disc_bad/SKILL.md"
case "$(check_2b "$tmp/disc_bad/SKILL.md")" in
  "FAIL "*) echo "  ok[2b]: negative self-test — bare Round-0 instance name caught" ;;
  *) echo "  FAIL: 2b negative self-test — missed a bare Round-0 name" >&2; fail=1 ;;
esac

# 2b negative self-test (ii): vacuity guard — if the §1.5.1 heading is renumbered so no
# spawn matches, the count guard must FAIL rather than silently print ok on zero.
mkdir -p "$tmp/disc_vac"
{ printf '%s\n' '#### 9.9. Renumbered heading (no longer 1.5.1)'
  printf 'Agent(subagent_type: "x", name: "codex-proxy-framing",\n'
} > "$tmp/disc_vac/SKILL.md"
case "$(check_2b "$tmp/disc_vac/SKILL.md")" in
  "FAIL "*) echo "  ok[2b]: negative self-test — vacuity guard fires when Round-0 spawns unseen" ;;
  *) echo "  FAIL: 2b vacuity guard did not fire on zero matches" >&2; fail=1 ;;
esac

[ "$fail" = 0 ] && echo "test-agent-name-collision.sh: PASS" || { echo "test-agent-name-collision.sh: FAIL" >&2; exit 1; }
