#!/bin/sh
# test-f080-bundle-contract.sh — the committed bundle must start with NO node_modules
# and expose the same tool surface as the pre-bundle server (F-080 AC8).
#
# sh-tap output (parser: sh-tap.v1). The clean room is built at runtime in a tmpdir:
# only dist/index.mjs is copied there, so a bundle that secretly still needs
# node_modules fails instead of silently resolving from the repo.
#
# Why this test exists rather than "the schema is unchanged by construction":
# bundling IS a build transformation. It rewrites module resolution, and the first
# build of this bundle died at startup on `Dynamic require of "child_process" is not
# supported` — it compiled clean, typechecked clean, and could not run. A contract
# test that reads the source instead of executing the artifact would have passed.
#
# SKIPS (does not fail) when no node runtime is present. A Node-free host is the
# normal state for this repo — Gemini is the only component that needs one — so the
# suite must stay green there. The skip is announced, never silent.
set -u
HERE=$(dirname "$0")
GEM=$(cd "$HERE/../../mcp-servers/gemini" && pwd)
BUNDLE="$GEM/dist/index.mjs"
fail=0
chk() { desc="$1"; exp="$2"; got="$3"
  if [ "$got" = "$exp" ]; then echo "  ok: $desc (-> $got)"
  else echo "  FAIL: $desc exp $exp got $got" >&2; fail=1; fi; }

if ! command -v node >/dev/null 2>&1; then
  # Exit 0 keeps the suite green — a Node-free host is normal for this repo, and the
  # bundle serves only the optional Gemini path. But the SUITE's verdict and the AC's
  # verdict are different questions, and the wording must not conflate them: an earlier
  # version ended with "PASS: f080 bundle contract (skipped)" and a reviewer reading the
  # last line recorded AC8 as satisfied by a run that never executed the bundle. Never
  # print PASS on a path that verified nothing.
  echo "  SKIP: no node runtime on this host — the bundle was NOT executed"
  echo "  AC8 is UNVERIFIED by this run, not satisfied. Do not record it as passing."
  echo "  To verify AC8, run on a host with node on PATH."
  echo "SKIP: f080 bundle contract — AC8 NOT VERIFIED (suite green: nothing failed)"
  exit 0
fi

# 1. The committed artifact exists. Without this the rest would skip vacuously.
chk "committed bundle present" "yes" "$([ -f "$BUNDLE" ] && echo yes || echo no)"
[ -f "$BUNDLE" ] || { echo "FAIL: f080 bundle contract" >&2; exit 1; }

# 2. Clean room: ONLY the bundle. No node_modules, no package.json, no src.
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp "$BUNDLE" "$T/index.mjs"
chk "clean room has no node_modules" "no" "$([ -d "$T/node_modules" ] && echo yes || echo no)"

# 3. Speak MCP to it. `perl -e alarm` bounds the run — the server holds an open pipe
#    and macOS has no timeout(1). GEMINI_API_KEY is a probe value: initAuth only
#    checks the variable is non-empty and makes no network call, so no request is
#    ever sent.
printf '%s\n%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"contract-test","version":"1"}}}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' > "$T/in.jsonl"
#    perl forks the server and reaps it on SIGALRM, then exits 0 itself. A plain
#    `alarm; exec` would make the foreground job die BY the signal, and the shell
#    prints "Alarm clock: 14" into the middle of the tap output. The server not
#    exiting on stdin EOF is expected — it is a long-lived stdio MCP server.
GEMINI_API_KEY=probe-key-never-sent \
  perl -e 'my $p=fork; if(!$p){ exec @ARGV; exit 127 }
           $SIG{ALRM}=sub{ kill "KILL",$p; waitpid $p,0; exit 0 };
           alarm 20; waitpid $p,0; exit 0' \
  -- node "$T/index.mjs" < "$T/in.jsonl" > "$T/out.jsonl" 2>"$T/err.log"

# 4. It started at all — the dynamic-require class of failure lands here.
chk "bundle starts without node_modules" "no" \
  "$(grep -qi 'Dynamic require\|Cannot find module\|ERR_MODULE_NOT_FOUND' "$T/err.log" && echo yes || echo no)"

# 5. MCP handshake completed.
chk "MCP initialize answered" "yes" \
  "$(grep -q '"protocolVersion"' "$T/out.jsonl" && echo yes || echo no)"

# 6. Tool surface preserved — all four, by name.
for t in chat reply models info; do
  chk "tool '$t' exposed" "yes" \
    "$(grep -q "\"name\":\"$t\"" "$T/out.jsonl" && echo yes || echo no)"
done

# 7. chat's parameters preserved. A bundle that starts and lists tools can still have
#    lost a schema; assert the params the contract names.
for p in prompt model systemPrompt; do
  chk "chat param '$p' preserved" "yes" \
    "$(grep -q "\"$p\"" "$T/out.jsonl" && echo yes || echo no)"
done

# 8. Session TTL unchanged at 30 minutes (contract value, not an implementation
#    detail — a re-host or re-bundle that silently changed it would strand sessions).
#    Asserted against the ARTIFACT THAT SHIPS, not src/index.ts: reading the source
#    would pass on source/bundle drift, which is the exact failure a contract test
#    over a build transformation exists to catch. The bundle inlines the literal
#    `30 * 60 * 1000`, and the `info` tool reports "30m" — check both.
#    Asserted on `sessionTTL: "30m"` because that is the only TTL evidence the
#    artifact actually carries: esbuild constant-folds `30 * 60 * 1000` away, so
#    neither the source expression nor `1800000` appears in the bundle. Verified by
#    grepping the built artifact for all three forms — only the reported string
#    survives. Honest limit: this pins the value the server REPORTS, not the value
#    it ENFORCES; a drift that changed the constant while leaving the label would
#    pass. Catching that needs an expiry-behaviour test, which is out of scope for
#    a contract test and would need a 30-minute clock or injectable time.
chk "session TTL still 30 minutes (in the shipped bundle)" "yes" \
  "$(grep -q 'sessionTTL: "30m"' "$BUNDLE" && echo yes || echo no)"

if [ "$fail" -eq 0 ]; then echo "PASS: f080 bundle contract"; else echo "FAIL: f080 bundle contract" >&2; fi
exit "$fail"
