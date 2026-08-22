#!/bin/sh
# test-relay-attestation.sh — mutation test for check-relay-attestation.sh
#
# The question under test: did a proxy agent actually reach its backend, or did it produce a
# cross-family verdict having reached nothing? `BL-212` is the incident — a proxy returned a
# full verdict with zero backend calls because its MCP tools arrived deferred and nothing
# noticed. Reading the archive by hand caught it once; this makes the reading mechanical.
#
# Several cases separate "the agent emitted a call" from "the backend answered": an error
# result, a call with no result, a result that precedes its call, a spawn still running, and a
# label whose spawn records and archives do not line up. The archive this ships against holds 8
# error results in 71 backend calls, so the first is not hypothetical.
#
# The exit contract the cases below encode: a declaration in the TREE that cannot be read exits
# non-zero always, because a person fixes it by editing a file. Everything the ARCHIVE says —
# including the classes where it cannot answer — is reported by default and exits non-zero only
# under --gate, because no change to the tree can repair a transcript written weeks ago.
#
# The script takes --transcripts and --agents so the whole corpus can be synthesised. Every
# case builds its own tree; none reads the real archive.
#
# Run: sh plugins/ae/tests/scripts/test-relay-attestation.sh

set -u

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS_DIR" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS_DIR/../../../.." && pwd))"
SCRIPT="$REPO/plugins/ae/scripts/check-relay-attestation.sh"

[ -f "$SCRIPT" ] || { echo "FAIL: cannot locate script under test at $SCRIPT"; exit 1; }

fails=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- fixture builders ---------------------------------------------------------------------

# seat <unused> <agents-dir> <seat-name> <mcp-server>
seat() {
  mkdir -p "$2"
  cat > "$2/$3.md" <<EOF
---
name: $3
description: synthetic seat for test
tools: Read, Grep, Bash, mcp__plugin_ae_$4__chat, mcp__plugin_ae_$4__reply
model: sonnet
---
Body.
EOF
}

# spawn <transcripts-dir> <session> <label> <subagent_type> <spawn-id> <returned:1|0>
# A spawn the host has not yet written a tool_result for is one still running.
spawn() {
  mkdir -p "$1"
  printf '%s\n' "{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"tool_use\",\"id\":\"$5\",\"name\":\"Agent\",\"input\":{\"name\":\"$3\",\"subagent_type\":\"$4\"}}]}}" >> "$1/$2.jsonl"
  [ "$6" = "1" ] && printf '%s\n' "{\"type\":\"user\",\"message\":{\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"$5\",\"content\":\"done\"}]}}" >> "$1/$2.jsonl"
  return 0
}

# calls <transcripts-dir> <session> <label> <hash> <tool>[:err]...
# A tool suffixed :err gets an is_error tool_result — the call was emitted, the backend was not
# reached.
calls() {
  d="$1/$2/subagents"; mkdir -p "$d"
  f="$d/agent-a$3-$4.jsonl"
  printf '%s\n' "{\"type\":\"user\",\"agentId\":\"a$3-$4\",\"message\":{\"content\":\"go\"}}" > "$f"
  shift 4
  i=0
  for spec in "$@"; do
    i=$((i + 1))
    t="${spec%:err}"; e=false
    [ "$spec" != "$t" ] && e=true
    printf '%s\n' "{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"tool_use\",\"id\":\"t$i\",\"name\":\"$t\",\"input\":{}}]}}" >> "$f"
    printf '%s\n' "{\"type\":\"user\",\"message\":{\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t$i\",\"is_error\":$e,\"content\":\"r\"}]}}" >> "$f"
  done
}

run() { # run <transcripts> <agents> [extra args...]
  t="$1"; a="$2"; shift 2
  out="$(sh "$SCRIPT" --transcripts "$t" --agents "$a" "$@" 2>&1)"; rc=$?
}

# --- Case 1: a proxy that reached its declared backend is ATTESTED -------------------------
C="$TMP/c1"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'ATTESTED .*codex-proxy'; then
  pass "attested: a backend call that returned classifies ATTESTED, exit 0"
else
  fail "attested: expected exit 0 + ATTESTED row, got exit $rc (out: $out)"
fi

# --- Case 2: zero backend calls is UNATTESTED — the BL-212 shape ---------------------------
C="$TMP/c2"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read Bash SendMessage
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'UNATTESTED'; then
  pass "unattested: zero backend calls classifies UNATTESTED, exit 0 without --gate"
else
  fail "unattested: expected exit 0 + UNATTESTED row, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "unattested: --gate turns UNATTESTED into a non-zero exit"
else
  fail "unattested: --gate must exit non-zero on UNATTESTED, got exit $rc (out: $out)"
fi

# --- Case 3: calling another seat's server is MISROUTED ------------------------------------
C="$TMP/c3"; seat "" "$C/agents" codex-proxy codex; seat "" "$C/agents" gemini-proxy gemini
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_gemini__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'MISROUTED'; then
  pass "misrouted: an MCP call outside the seat's declaration classifies MISROUTED"
else
  fail "misrouted: expected MISROUTED row, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "misrouted: --gate turns MISROUTED into a non-zero exit"
else
  fail "misrouted: --gate must exit non-zero on MISROUTED, got exit $rc (out: $out)"
fi

# --- Case 4: the prefix comes from the definition, never from a hardcoded list -------------
C="$TMP/c4"; seat "" "$C/agents" zzz-proxy zzz
spawn "$C/tr" s1 zzz-proxy ae:workflow:zzz-proxy id1 1
calls "$C/tr" s1 zzz-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_zzz__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'ATTESTED .*zzz-proxy'; then
  pass "declaration-derived: an unknown seat is classified from its own tools: line"
else
  fail "declaration-derived: expected ATTESTED for zzz-proxy, got exit $rc (out: $out)"
fi

# --- Case 5: a returned spawn with no archive fails closed --------------------------------
C="$TMP/c5"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
mkdir -p "$C/tr/s1/subagents"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'NO-TRANSCRIPT'; then
  pass "archive-side: a finished spawn with no transcript is reported, exit 0 by default"
else
  fail "archive-side: expected exit 0 + NO-TRANSCRIPT, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "archive-side: --gate turns NO-TRANSCRIPT into a non-zero exit"
else
  fail "archive-side: --gate must exit non-zero on NO-TRANSCRIPT, got exit $rc (out: $out)"
fi

# --- Case 6: a seat that no longer exists is reported, not failed -------------------------
C="$TMP/c6"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 omlx-proxy ae:workflow:omlx-proxy id1 1
calls "$C/tr" s1 omlx-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_openai-compat__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'UNRESOLVED-SEAT'; then
  pass "retired seat: reported as UNRESOLVED-SEAT, non-gating"
else
  fail "retired seat: expected exit 0 + UNRESOLVED-SEAT, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -eq 0 ]; then
  pass "retired seat: still non-gating under --gate"
else
  fail "retired seat: --gate must not redden on an unresolvable seat, got exit $rc (out: $out)"
fi

# --- Case 7: no archive at all is 'not applicable', never a pass-by-emptiness --------------
C="$TMP/c7"; seat "" "$C/agents" codex-proxy codex
run "$C/nonexistent" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'not applicable'; then
  pass "absent archive: reports not applicable, exit 0"
else
  fail "absent archive: expected exit 0 + 'not applicable', got exit $rc (out: $out)"
fi

# --- Case 8: a proxy definition with no tools: line fails closed ---------------------------
C="$TMP/c8"; mkdir -p "$C/agents"
printf -- '---\nname: broken-proxy\nmodel: sonnet\n---\nBody.\n' > "$C/agents/broken-proxy.md"
spawn "$C/tr" s1 broken-proxy ae:workflow:broken-proxy id1 1
calls "$C/tr" s1 broken-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "fails closed: a seat with no tools: line exits non-zero"
else
  fail "fails closed: expected non-zero + NO-DECLARATION, got exit $rc (out: $out)"
fi

# --- Case 9: a seat that declares no MCP tools is not a relay seat -------------------------
C="$TMP/c9"; mkdir -p "$C/agents"
printf -- '---\nname: architect\ndescription: no backend\ntools: Read, Grep, Glob, Bash\n---\nBody.\n' > "$C/agents/architect.md"
seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 architect ae:workflow:architect id1 1
calls "$C/tr" s1 architect aaaaaaaaaaaaaaaa Read Grep Bash
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id2 1
calls "$C/tr" s1 codex-proxy bbbbbbbbbbbbbbbb mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] \
   && ! printf '%s' "$out" | grep -q 'UNATTESTED' \
   && printf '%s' "$out" | grep -q 'NOT-RELAY=1' \
   && printf '%s' "$out" | grep -q 'ATTESTED .*codex-proxy'; then
  pass "not-a-relay: a seat declaring no MCP tools is counted apart, never UNATTESTED"
else
  fail "not-a-relay: expected no UNATTESTED + NOT-RELAY=1 + ATTESTED codex-proxy, got exit $rc (out: $out)"
fi

# --- Case 10: an emitted call whose result is an error did not reach the backend -----------
# The strongest of the cross-family findings. Scanning call names alone reports the proxy as
# having consulted a backend that returned it nothing.
C="$TMP/c10"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read mcp__plugin_ae_codex__chat:err
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -q 'CALL-FAILED' \
   && ! printf '%s' "$out" | grep -q '  ATTESTED'; then
  pass "error result: an errored backend call is CALL-FAILED, never ATTESTED"
else
  fail "error result: expected CALL-FAILED and no ATTESTED row, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "error result: --gate turns CALL-FAILED into a non-zero exit"
else
  fail "error result: --gate must exit non-zero on CALL-FAILED, got exit $rc (out: $out)"
fi

# --- Case 10b: one error among several calls still attests -------------------------------
# A retry that succeeds reached the backend. Only 'every call errored' is CALL-FAILED.
C="$TMP/c10b"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat:err mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'ATTESTED'; then
  pass "error result: a failed call followed by a good one still attests"
else
  fail "error result: expected ATTESTED, got exit $rc (out: $out)"
fi

# --- Case 11: a spawn the host has not closed out is still running, not unattested ---------
# Reading the archive while an agent works would otherwise report it as having called nothing.
C="$TMP/c11"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 0
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -q 'IN-FLIGHT' \
   && ! printf '%s' "$out" | grep -q 'UNATTESTED'; then
  pass "in-flight: an unreturned spawn is IN-FLIGHT, never UNATTESTED"
else
  fail "in-flight: expected IN-FLIGHT and no UNATTESTED, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -eq 0 ]; then
  pass "in-flight: still non-gating under --gate"
else
  fail "in-flight: --gate must not redden on a running spawn, got exit $rc (out: $out)"
fi

# --- Case 12: spawn records and archives that do not line up cannot be joined --------------
# Two spawns of one label with one archive: attributing that archive to both would let a single
# real call attest a run that made none.
C="$TMP/c12"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id2 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'AMBIGUOUS-JOIN'; then
  pass "ambiguous join: 2 spawns and 1 archive is reported rather than guessed at"
else
  fail "ambiguous join: expected exit 0 + AMBIGUOUS-JOIN, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "ambiguous join: --gate turns it into a non-zero exit"
else
  fail "ambiguous join: --gate must exit non-zero, got exit $rc (out: $out)"
fi

# --- Case 13: a shorter label must not claim a longer label's archive ---------------------
# Spawn label is `codex`; the only archive present belongs to `codex-proxy-2`. Matching on a
# prefix rather than the whole agentId would hand one to the other.
C="$TMP/c13"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy-2 aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if printf '%s' "$out" | grep -q 'NO-TRANSCRIPT'; then
  pass "label join: 'codex' does not claim 'codex-proxy-2''s archive"
else
  fail "label join: expected NO-TRANSCRIPT for label 'codex', got exit $rc (out: $out)"
fi

# --- Case 14: a call with no result at all is incomplete, not failed -----------------------
# "Every call returned an error" is a claim about results that exist. A call still in flight,
# or a transcript read between the call line and its result line, has no result to judge.
C="$TMP/c14"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
d="$C/tr/s1/subagents"; mkdir -p "$d"
f="$d/agent-acodex-proxy-aaaaaaaaaaaaaaaa.jsonl"
printf '%s\n' '{"type":"user","agentId":"acodex-proxy-aaaaaaaaaaaaaaaa","message":{"content":"go"}}' > "$f"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"mcp__plugin_ae_codex__chat","input":{}}]}}' >> "$f"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -q 'INCOMPLETE' \
   && ! printf '%s' "$out" | grep -q 'CALL-FAILED'; then
  pass "no result: an unanswered call is INCOMPLETE, never CALL-FAILED"
else
  fail "no result: expected exit 0 + INCOMPLETE, no CALL-FAILED, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "no result: --gate turns INCOMPLETE into a non-zero exit"
else
  fail "no result: --gate must exit non-zero on INCOMPLETE, got exit $rc (out: $out)"
fi

# --- Case 15: a result that arrives before its call cannot pair with it --------------------
# Pairing by id alone lets an earlier result attest a later call.
C="$TMP/c15"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
d="$C/tr/s1/subagents"; mkdir -p "$d"
f="$d/agent-acodex-proxy-aaaaaaaaaaaaaaaa.jsonl"
printf '%s\n' '{"type":"user","agentId":"acodex-proxy-aaaaaaaaaaaaaaaa","message":{"content":"go"}}' > "$f"
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":false,"content":"r"}]}}' >> "$f"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"mcp__plugin_ae_codex__chat","input":{}}]}}' >> "$f"
run "$C/tr" "$C/agents"
if ! printf '%s' "$out" | grep -q '  ATTESTED'; then
  pass "ordering: a result preceding its call does not attest it"
else
  fail "ordering: expected no ATTESTED row, got exit $rc (out: $out)"
fi

# --- Case 16: two seat files claiming one name cannot both be the declaration --------------
C="$TMP/c16"; mkdir -p "$C/agents"
seat "" "$C/agents" codex-proxy codex
printf -- '---\nname: codex-proxy\ndescription: shadow\ntools: Read, mcp__plugin_ae_other__chat\n---\nBody.\n' > "$C/agents/zz-shadow.md"
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "duplicate seat name: fails closed rather than letting filename order decide"
else
  fail "duplicate seat name: expected non-zero + NO-DECLARATION, got exit $rc (out: $out)"
fi

# --- Case 17: a tools: line the parser cannot read is not a seat without a backend ---------
# A YAML list parses to no MCP tools under an inline-comma reader. Reporting that as NOT-RELAY
# excludes the seat from the audit entirely — a silent pass, which is this feature's subject.
C="$TMP/c17"; mkdir -p "$C/agents"
printf -- '---\nname: listy-proxy\ndescription: list form\ntools:\n  - Read\n  - mcp__plugin_ae_listy__chat\n---\nBody.\n' > "$C/agents/listy-proxy.md"
spawn "$C/tr" s1 listy-proxy ae:workflow:listy-proxy id1 1
calls "$C/tr" s1 listy-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_listy__chat
run "$C/tr" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "unreadable tools: line fails closed instead of passing as NOT-RELAY"
else
  fail "unreadable tools: expected non-zero + NO-DECLARATION, got exit $rc (out: $out)"
fi

# --- Case 18: a corrupt line in the middle of a transcript is not a skippable tail ---------
C="$TMP/c18"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
f="$C/tr/s1/subagents/agent-acodex-proxy-aaaaaaaaaaaaaaaa.jsonl"
{ head -1 "$f"; echo '{"type":"assistant","message":{"cont'; tail -n +2 "$f"; } > "$f.new" && mv "$f.new" "$f"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'UNREADABLE'; then
  pass "corrupt line: an unparseable non-final line is reported as UNREADABLE"
else
  fail "corrupt line: expected exit 0 + UNREADABLE, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "corrupt line: --gate turns UNREADABLE into a non-zero exit"
else
  fail "corrupt line: --gate must exit non-zero on UNREADABLE, got exit $rc (out: $out)"
fi

# --- Case 19: an is_error value that is not a boolean must not attest ---------------------
# The two wrong answers are not symmetric. Reading a real error as a reached backend is the
# defect this script already carried once; reading a clean result as an error only costs a
# false red. So anything that is not an explicit absence or `false` counts as an error.
mkerr() { # mkerr <dir> <is_error-json-literal>
  d="$1/s1/subagents"; mkdir -p "$d"
  f="$d/agent-acodex-proxy-aaaaaaaaaaaaaaaa.jsonl"
  printf '%s\n' '{"type":"user","agentId":"acodex-proxy-aaaaaaaaaaaaaaaa","message":{"content":"go"}}' > "$f"
  printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"mcp__plugin_ae_codex__chat","input":{}}]}}' >> "$f"
  printf '%s\n' "{\"type\":\"user\",\"message\":{\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"t1\",\"is_error\":$2,\"content\":\"r\"}]}}" >> "$f"
}

C="$TMP/c19"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
mkerr "$C/tr" '"true"'
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ] && ! printf '%s' "$out" | grep -q '  ATTESTED'; then
  pass "is_error: the string \"true\" is an error, and does not attest under --gate"
else
  fail "is_error: string \"true\" must not attest, got exit $rc (out: $out)"
fi

C="$TMP/c19b"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
mkerr "$C/tr" 'false'
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'ATTESTED'; then
  pass "is_error: the boolean false attests"
else
  fail "is_error: boolean false must attest, got exit $rc (out: $out)"
fi

C="$TMP/c19c"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
mkerr "$C/tr" 'null'
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'ATTESTED'; then
  pass "is_error: an absent flag (null) attests"
else
  fail "is_error: null must attest, got exit $rc (out: $out)"
fi

# --- Case 20: a label group part-finished is unfinished, not unjoinable -------------------
# Re-running a label is ordinary practice, and 5 relay-seat label groups in the live archive
# have more than one spawn. Calling the window between them unclassifiable reddens routinely.
C="$TMP/c20"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id2 0
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents" --gate
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -q 'IN-FLIGHT' \
   && ! printf '%s' "$out" | grep -q 'AMBIGUOUS-JOIN'; then
  pass "part-finished group: IN-FLIGHT, non-gating — never AMBIGUOUS-JOIN"
else
  fail "part-finished group: expected exit 0 + IN-FLIGHT, no AMBIGUOUS-JOIN, got exit $rc (out: $out)"
fi

# --- Case 21: a spawn with no name is classified, not dropped ------------------------------
# `name` is optional on the spawn. Dropping it left the BL-212 shape reading as a clean run.
C="$TMP/c21"; seat "" "$C/agents" codex-proxy codex
mkdir -p "$C/tr"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"id1","name":"Agent","input":{"subagent_type":"ae:workflow:codex-proxy"}}]}}' > "$C/tr/s1.jsonl"
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"id1","content":"done"}]}}' >> "$C/tr/s1.jsonl"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] \
   && printf '%s' "$out" | grep -q 'NO-LABEL' \
   && ! printf '%s' "$out" | grep -q 'not applicable'; then
  pass "unnamed spawn: classified NO-LABEL, never dropped into 'not applicable'"
else
  fail "unnamed spawn: expected NO-LABEL and no 'not applicable', got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "unnamed spawn: --gate turns NO-LABEL into a non-zero exit"
else
  fail "unnamed spawn: --gate must exit non-zero on NO-LABEL, got exit $rc (out: $out)"
fi

# --- Case 22: no seat declarations to read is not an audit that passed --------------------
# Every spawn would fall to the non-gating UNRESOLVED-SEAT and the run would report green
# having checked nothing.
C="$TMP/c22"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read
run "$C/tr" "$C/nonexistent-agents" --gate
if [ "$rc" -ne 0 ]; then
  pass "no declarations: a missing agents directory exits non-zero rather than auditing nothing"
else
  fail "no declarations: expected non-zero for a missing --agents dir, got exit $rc (out: $out)"
fi

# --- Case 23: an unnamed spawn of a seat that fronts no backend is not a relay failure -----
# NO-LABEL asks "which archive is this run's?", a question only worth asking once the seat is
# known to relay. `architect` and the doodlestein seats are most of what gets spawned; a retired
# seat must never gate at all. Checking NO-LABEL first made both of them gate.
C="$TMP/c23"; mkdir -p "$C/agents"
printf -- '---\nname: architect\ndescription: no backend\ntools: Read, Grep, Bash\n---\nBody.\n' > "$C/agents/architect.md"
seat "" "$C/agents" codex-proxy codex
mkdir -p "$C/tr"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"i1","name":"Agent","input":{"subagent_type":"ae:workflow:architect"}}]}}' > "$C/tr/s1.jsonl"
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"i1","content":"d"}]}}' >> "$C/tr/s1.jsonl"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"i2","name":"Agent","input":{"subagent_type":"ae:workflow:omlx-proxy"}}]}}' >> "$C/tr/s1.jsonl"
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"i2","content":"d"}]}}' >> "$C/tr/s1.jsonl"
run "$C/tr" "$C/agents" --gate
if [ "$rc" -eq 0 ] \
   && ! printf '%s' "$out" | grep -q 'NO-LABEL' \
   && printf '%s' "$out" | grep -q 'UNRESOLVED-SEAT' \
   && printf '%s' "$out" | grep -q 'NOT-RELAY=1'; then
  pass "unnamed non-relay/retired seats: NOT-RELAY and UNRESOLVED-SEAT, never NO-LABEL"
else
  fail "unnamed non-relay/retired: expected exit 0, no NO-LABEL, got exit $rc (out: $out)"
fi

# --- Case 24: an agents directory that exists but yields no seats -------------------------
# A directory of files with no readable frontmatter is this script pointed somewhere wrong. It
# used to leave every spawn at the non-gating UNRESOLVED-SEAT and report green.
C="$TMP/c24"; mkdir -p "$C/agents-empty" "$C/agents-nofm" "$C/tr"
printf 'just a readme\n' > "$C/agents-nofm/codex-proxy.md"
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read
run "$C/tr" "$C/agents-empty"
if [ "$rc" -ne 0 ]; then
  pass "no seats: an empty agents directory exits non-zero"
else
  fail "no seats: expected non-zero for an empty agents dir, got exit $rc (out: $out)"
fi
run "$C/tr" "$C/agents-nofm"
if [ "$rc" -ne 0 ]; then
  pass "no seats: a directory whose .md files carry no frontmatter exits non-zero"
else
  fail "no seats: expected non-zero for frontmatter-less .md files, got exit $rc (out: $out)"
fi

# --- Case 25: a broken declaration gates even when no spawn of it is in the archive -------
# This is the check's only unconditional teeth. Reaching NO-DECLARATION through the per-spawn
# loop made it conditional on the archive holding a matching spawn, so a broken declaration
# passed on a fresh clone and on CI — the machines least likely to have one.
C="$TMP/c25"; mkdir -p "$C/agents" "$C/tr"
printf -- '---\nname: codex-proxy\ndescription: list form\ntools:\n  - Read\n  - mcp__plugin_ae_codex__chat\n---\nBody.\n' > "$C/agents/codex-proxy.md"
run "$C/tr" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "broken declaration: gates with an archive that holds no spawn of that seat"
else
  fail "broken declaration: expected non-zero + NO-DECLARATION, got exit $rc (out: $out)"
fi
run "$C/nonexistent" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "broken declaration: gates with no archive directory at all"
else
  fail "broken declaration: expected non-zero + NO-DECLARATION with no archive, got exit $rc (out: $out)"
fi

# --- Case 26: the derivation advice belongs only to the derived default -------------------
C="$TMP/c26"; seat "" "$C/agents" codex-proxy codex
run "$C/nowhere" "$C/agents"
if [ "$rc" -eq 0 ] && ! printf '%s' "$out" | grep -q 'derived from the repo path'; then
  pass "explicit --transcripts: the missing-archive note does not blame a derivation"
else
  fail "explicit --transcripts: must not mention the derivation, got exit $rc (out: $out)"
fi

# --- Case 27: --quiet prints nothing and still carries the exit code ----------------------
C="$TMP/c27"; seat "" "$C/agents" codex-proxy codex
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa Read
run "$C/tr" "$C/agents" --quiet --gate
if [ "$rc" -ne 0 ] && [ -z "$out" ]; then
  pass "--quiet: no output, exit code still reflects --gate"
else
  fail "--quiet: expected silence and non-zero, got exit $rc (out: $out)"
fi

# --- Case 28: a seat with no tools: line is legal, not a tree defect ----------------------
# `tools` is optional in AE's agent contract — absent means every tool, and agent-authoring.md
# tells authors to add it later. `minimal-change-engineer.md` ships without one. Treating its
# absence as a defect made the check exit 1 on any machine, with no archive at all.
C="$TMP/c28"; mkdir -p "$C/agents" "$C/tr"
printf -- '---\nname: notools-agent\ndescription: no tools line at all\nmodel: sonnet\n---\nBody.\n' > "$C/agents/notools-agent.md"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ]; then
  pass "optional tools: a seat without a tools: line does not gate an empty archive"
else
  fail "optional tools: expected exit 0, got exit $rc (out: $out)"
fi
run "$C/nonexistent" "$C/agents" --gate
if [ "$rc" -eq 0 ]; then
  pass "optional tools: still does not gate under --gate with no archive"
else
  fail "optional tools: --gate with no archive must not redden, got exit $rc (out: $out)"
fi

# --- Case 29: an unparseable tools: line IS a tree defect and gates without an archive -----
C="$TMP/c29"; mkdir -p "$C/agents" "$C/tr"
printf -- '---\nname: listy-proxy\ntools:\n  - mcp__plugin_ae_listy__chat\n---\nBody.\n' > "$C/agents/listy-proxy.md"
run "$C/tr" "$C/agents"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'NO-DECLARATION'; then
  pass "tree defect: an unparseable tools: line still gates with no archive"
else
  fail "tree defect: expected non-zero + NO-DECLARATION, got exit $rc (out: $out)"
fi

# --- Case 30: one broken declaration is one finding, not two ------------------------------
# Reported up front AND again per spawn tallied the same defect twice.
C="$TMP/c30"; mkdir -p "$C/agents" "$C/tr"
printf -- '---\nname: codex-proxy\ntools:\n  - mcp__plugin_ae_codex__chat\n---\nBody.\n' > "$C/agents/codex-proxy.md"
spawn "$C/tr" s1 codex-proxy ae:workflow:codex-proxy id1 1
calls "$C/tr" s1 codex-proxy aaaaaaaaaaaaaaaa mcp__plugin_ae_codex__chat
run "$C/tr" "$C/agents"
if printf '%s' "$out" | grep -q 'NO-DECLARATION=1'; then
  pass "one defect one row: a broken declaration with a spawn tallies once"
else
  fail "one defect one row: expected NO-DECLARATION=1, got exit $rc (out: $out)"
fi

# --- Case 31: an unnamed spawn never prints a blank label column --------------------------
C="$TMP/c31"; mkdir -p "$C/agents" "$C/tr"
printf -- '---\nname: architect\ntools: Read, Grep\n---\nBody.\n' > "$C/agents/architect.md"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"i1","name":"Agent","input":{"subagent_type":"ae:workflow:architect"}}]}}' > "$C/tr/s1.jsonl"
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"i1","content":"d"}]}}' >> "$C/tr/s1.jsonl"
run "$C/tr" "$C/agents"
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'NOT-RELAY=1'; then
  pass "unnamed spawn: routed to NOT-RELAY with a placeholder label, exit 0"
else
  fail "unnamed spawn: expected exit 0 + NOT-RELAY=1, got exit $rc (out: $out)"
fi

echo "---"
if [ "$fails" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$fails FAILURE(S)"
  exit 1
fi
