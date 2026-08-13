#!/bin/sh
# test-f080-proxy-spawn-precondition.sh — the spawn precondition must exist in BOTH
# locations, and the gemma4 fallback licence must be gone (F-080 AC2, AC3).
#
# sh-tap output (parser: sh-tap.v1). Fixture trees are built at runtime in a tmpdir:
# the negative cases mutate COPIES of the two skill files, never the real ones.
#
# Threat model — drift, not sabotage. The content checks below use substring matches,
# so text that quotes the rule verbatim while negating it around the quote would pass
# ("Disregard the obsolete rule: <rule>. Always spawn instead."). That is accepted:
# closing it needs anchored full-sentence matching, which forfeits the survives-a-
# legitimate-rewording property checks 6-9 depend on — and an author willing to wrap
# the rule in a negation can equally delete the assertion, since this file sits in the
# same repo as the rule it guards. Every accidental regression found while building
# this test (swallowed heading, deleted code fence, blanked join keys, wholesale text
# replacement) is caught; deliberate gaming is out of scope by design.
#
# Why both locations: the canonical statement carries the rule and its boundary;
# the inline echo carries compliance. Referenced-only rules measure ~0 adherence
# (tests/prompts/shutdown-json-object-clause.md), so a canonical statement with no
# echo is a rule nobody applies. Asserting only "present somewhere" would pass on
# either half alone — the exact vacuity this test exists to avoid.
set -u
HERE=$(dirname "$0")
SKILLS=$(cd "$HERE/../../skills" && pwd)
CANON="agent-selection/SKILL.md"
ECHOF="discuss/SKILL.md"
fail=0
chk() { desc="$1"; exp="$2"; got="$3"
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (-> $got)"
  else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

# The check under test: all three conditions must hold for a tree to be "pass".
# Returns "pass" or the name of the first condition that failed.
# Each location must carry BOTH its label and the rule's own words. A label-only
# check is satisfied by text that says the opposite of the rule — verified: replacing
# the echo with "**Spawn precondition** — always spawn every configured proxy" passed
# a label-only version of this test 14/14. Presence of a heading is not content.
RULE='do not spawn a cross-family proxy whose backend mcp tool is absent'
check_tree() {
  d="$1"
  grep -q '^### Proxy spawn precondition' "$d/$CANON" 2>/dev/null || { echo "no-canonical"; return; }
  grep -qi "$RULE" "$d/$CANON" 2>/dev/null || { echo "no-canonical"; return; }
  grep -q '^\*\*Spawn precondition\*\*' "$d/$ECHOF" 2>/dev/null || { echo "no-echo"; return; }
  grep -qi "$RULE" "$d/$ECHOF" 2>/dev/null || { echo "no-echo"; return; }
  grep -qi 'run the TL fallback logic' "$d/$ECHOF" 2>/dev/null || { echo "no-echo"; return; }
  grep -qi 'gemma' "$d/$ECHOF" 2>/dev/null && { echo "gemma-present"; return; }
  echo "pass"
}

# Build a fixture copy of the two files under test.
mkfixture() {
  t=$(mktemp -d)
  mkdir -p "$t/agent-selection" "$t/discuss"
  cp "$SKILLS/$CANON" "$t/$CANON"
  cp "$SKILLS/$ECHOF" "$t/$ECHOF"
  echo "$t"
}

# 1. POSITIVE — the real tree satisfies all three conditions.
real=$(mkfixture); trap 'rm -rf "$real"' EXIT
chk "real tree passes all three conditions" "pass" "$(check_tree "$real")"

# 2. NEGATIVE — canonical statement removed, echo intact.
#    This is the 'both required' claim: an echo with no canonical rule behind it
#    must NOT pass. A test that only distinguishes all-present from all-absent
#    would miss this.
t=$(mkfixture)
grep -v '^### Proxy spawn precondition' "$t/$CANON" > "$t/tmp" && mv "$t/tmp" "$t/$CANON"
chk "canonical removed (echo intact) fails" "no-canonical" "$(check_tree "$t")"; rm -rf "$t"

# 3. NEGATIVE — echo removed, canonical intact. The other half of 'both required'.
t=$(mkfixture)
grep -v '^\*\*Spawn precondition\*\*' "$t/$ECHOF" > "$t/tmp" && mv "$t/tmp" "$t/$ECHOF"
chk "echo removed (canonical intact) fails" "no-echo" "$(check_tree "$t")"; rm -rf "$t"

# 4. NEGATIVE — the gemma4 fallback licence reintroduced. It contradicted the proxy
#    contract (report unavailable and STOP) and pointed at a strategy that has never
#    existed in any commit; its return must break the build.
t=$(mkfixture)
printf 'if Gemini API unavailable, fall back to local gemma4:26b per CLAUDE.md\n' >> "$t/$ECHOF"
chk "gemma4 licence reintroduced fails" "gemma-present" "$(check_tree "$t")"; rm -rf "$t"

# 5. NEGATIVE — both halves removed. Accepts EITHER failure name: which grep runs
#    first is an implementation detail of check_tree, not a behavioural contract,
#    and pinning it would fail a harmless reorder.
t=$(mkfixture)
grep -v '^### Proxy spawn precondition' "$t/$CANON" > "$t/a" && mv "$t/a" "$t/$CANON"
grep -v '^\*\*Spawn precondition\*\*' "$t/$ECHOF" > "$t/b" && mv "$t/b" "$t/$ECHOF"
case "$(check_tree "$t")" in
  no-canonical|no-echo) echo "  ok: both removed fails (either half reported)" ;;
  *) echo "  FAIL: both removed did not fail" >&2; fail=1 ;;
esac
rm -rf "$t"

# 5b. NEGATIVE — the echo's label kept but its rule replaced by the OPPOSITE
#     instruction. This is the case that passed a label-only version of this test
#     14/14, so it is the specific regression being pinned.
t=$(mkfixture)
grep -v '^\*\*Spawn precondition\*\*' "$t/$ECHOF" > "$t/c" && mv "$t/c" "$t/$ECHOF"
printf '**Spawn precondition** — always spawn every configured proxy; no fallback is needed.\n' >> "$t/$ECHOF"
chk "echo label kept, rule inverted, fails" "no-echo" "$(check_tree "$t")"; rm -rf "$t"

# 5c. NEGATIVE — the canonical heading kept but its rule paragraph removed.
t=$(mkfixture)
grep -vi 'do not spawn a cross-family proxy whose backend MCP tool is absent' "$t/$CANON" > "$t/d" && mv "$t/d" "$t/$CANON"
chk "canonical heading kept, rule removed, fails" "no-canonical" "$(check_tree "$t")"; rm -rf "$t"

# 6. The canonical section must carry the boundary, and the echo must NOT — the echo
#    is one sentence by design (padding it defeats the reason for echoing at all).
chk "boundary lives in canonical" "yes" \
  "$(grep -q 'Boundary — what this does NOT cover' "$SKILLS/$CANON" && echo yes || echo no)"
chk "boundary absent from echo site" "yes" \
  "$(grep -q 'Boundary — what this does NOT cover' "$SKILLS/$ECHOF" && echo no || echo yes)"

# 7. A precondition skip must enter the fallback state machine and write its own WAL
#    record — a proxy that was never spawned cannot write one, and without it a
#    degraded skip leaves no record at all (neither failure nor covered).
chk "skip enters fallback + writes TL-side failure record" "yes" \
  "$(grep -q 'The TL writes the failure record itself' "$SKILLS/$CANON" && echo yes || echo no)"

# 7b. The TL-side invocation ITSELF must exist, not merely the prose describing it,
#     and every WAL join-key slot must be populated. A `.*` between the subcommand
#     and the reason is satisfied by `failure "" "" connection` — blanking the join
#     keys makes every record unjoinable while the record still looks well-formed,
#     which is the documented join-key fragility in trace-schema.md. Pin the slots.
chk "TL-side failure invocation exists with populated join keys" "1" \
  "$(grep -cE 'append-cross-family-trace\.sh" failure "<skill>" "<feature_id>" "<angle>" "<family>" connection' "$SKILLS/$CANON" 2>/dev/null || true)"

# 8. Every append-cross-family-trace.sh INVOCATION carries the mkdir prefix. Without
#    it the shell opens the 2>> redirect before the script runs, the open fails on a
#    fresh ~/.ae/traces, `|| true` swallows it, and the record vanishes silently.
# grep -c prints the count AND exits 1 on zero matches; do not add an `|| echo 0`
# fallback or the count becomes "0\n0" and the comparison fails on a passing tree.
# The `^ *` is load-bearing: the TL-fallback invocation is indented inside a code
# block, so a `^`-anchored pattern would miss an unprefixed invocation there.
missing=$(grep -c '^ *bash "${CLAUDE_PLUGIN_ROOT' "$SKILLS/$CANON" 2>/dev/null)
chk "no trace invocation lacks the mkdir prefix" "0" "$missing"

# 8b. Counting only the UNPREFIXED invocations is vacuously satisfiable — delete
#     every invocation and the count is 0. Assert the expected number of prefixed
#     invocations actually exists, so deletion fails the test instead of passing it.
#     Three today: precondition skip, proxy prompt suffix, TL fallback `covered`.
chk "all three prefixed trace invocations present" "3" \
  "$(grep -c '^ *mkdir -p "\$HOME/.ae/traces" || true; bash' "$SKILLS/$CANON" 2>/dev/null || true)"

# 9. The three fixes added during step-3 review are load-bearing and unasserted
#     elsewhere — any could be deleted silently. Anchored on stable fragments, not
#     whole sentences, so rewording does not break them.
chk "ToolSearch scoping of 'absent' retained" "yes" \
  "$(grep -q 'after deferred-tool resolution' "$SKILLS/$CANON" && echo yes || echo no)"
chk "slow-vs-absent boundary case retained" "yes" \
  "$(grep -q 'slow rather than absent' "$SKILLS/$CANON" && echo yes || echo no)"
chk "Claude-coverage-is-degraded forward ref retained" "yes" \
  "$(grep -q 'still sets `cross_family_degraded`' "$SKILLS/$CANON" && echo yes || echo no)"

if [ "$fail" -eq 0 ]; then echo "PASS: f080 spawn precondition"; else echo "FAIL: f080 spawn precondition" >&2; fi
exit "$fail"
