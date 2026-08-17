#!/bin/sh
# test-findings-format-compliance.sh — F-082 AC7.
#
# The backend emits the findings format directly, and a reply that misses is REPORTED rather
# than reshaped. Reshaping is the defect: the relay would supply severity and location the
# backend never produced while the report still reads as the backend's.
#
# Two halves, and the split is what keeps the suite environment-independent:
#
#   DETERMINISTIC (always runs) — a stub HTTP server on an ephemeral port returns canned replies
#     and the bridge is pointed at it. This is where the negative cases live: a missing required
#     field, a severity outside the allowed set, and prose instead of JSON. They are the
#     assertions that matter and they must not depend on talking a real model into misbehaving.
#
#   LIVE (skips when nothing answers) — one real call to the configured endpoint, asserting a
#     backend not tuned for AE's conventions can satisfy the contract. `ae-run-tests.sh` globs
#     every test-*.sh and treats non-zero as a hard FAIL, and no other test makes a network
#     call; a machine with no local model server is the common case, including CI. So this half
#     reports SKIP with its reason and does not affect the exit code.
#
# The spec (`tests/specs/findings-format.jq`) and the bridge's runtime validator are two
# implementations of one contract, so they are checked against each other on the same payloads
# rather than trusted to agree. Two validators drifting apart silently is this feature's subject.
#
# Run: sh plugins/ae/tests/scripts/test-findings-format-compliance.sh

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
BUNDLE="$REPO/plugins/ae/mcp-servers/openai-compat/dist/index.mjs"
SPEC="$REPO/plugins/ae/tests/specs/findings-format.jq"
RUNNER="$REPO/plugins/ae/scripts/verify-contract.sh"
fail=0
ok()   { echo "  ok: $1"; }
bad()  { echo "  FAIL: $1" >&2; fail=1; }
skip() { echo "  SKIP: $1"; }

[ -f "$SPEC" ]   || { bad "spec missing: $SPEC"; exit 1; }
[ -f "$RUNNER" ] || { bad "contract runner missing: $RUNNER"; exit 1; }
[ -f "$BUNDLE" ] || { bad "bridge bundle missing: $BUNDLE (it is committed; a build is not required to run this)"; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  skip "node not available — the bridge cannot be driven; nothing here is asserted"
  echo "test-findings-format-compliance: PASS (skipped)"
  exit 0
fi
if ! command -v jq >/dev/null 2>&1; then
  skip "jq not available — the contract runner cannot execute the spec"
  echo "test-findings-format-compliance: PASS (skipped)"
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM

# --- one validator, not one per bridge ------------------------------------------------------
# The behavioural half below drives the openai-compat bridge only, because that is the path with
# a free local backend and a stubbable endpoint. That coverage transfers to the other AE-owned
# bridge only while both call the SAME validator — so the sharing is asserted, not assumed. A
# copy-pasted second implementation would pass every behavioural assertion here and drift after.
SHARED="$REPO/plugins/ae/mcp-servers/shared/findings-contract.ts"
if [ ! -f "$SHARED" ]; then
  bad "shared contract module missing: $SHARED"
else
  ok "the contract has one home (mcp-servers/shared/findings-contract.ts)"
  for srv in openai-compat gemini; do
    s="$REPO/plugins/ae/mcp-servers/$srv/src/index.ts"
    [ -f "$s" ] || { bad "$srv: src/index.ts missing"; continue; }
    if grep -q 'shared/findings-contract' "$s"; then
      grep -q 'expect' "$s" \
        && ok "$srv: imports the shared contract and exposes \`expect\`" \
        || bad "$srv: imports the contract but exposes no \`expect\` parameter to reach it"
    else
      bad "$srv: does not import the shared contract — a second validator drifts silently"
    fi
    # A local FINDINGS_CONTRACT/checkFindings definition means the module was copied, not shared.
    if grep -qE '^(export )?(const FINDINGS_CONTRACT|function checkFindings)' "$s"; then
      bad "$srv: defines the contract locally as well — that is the second validator"
    fi
  done
fi

# The codex path is deliberately absent from that loop. AE owns no code between the codex proxy
# and its backend — the transport is the vendor CLI over MCP — so there is no bridge boundary to
# validate at, and a contract there can only be stated in prose and checked consumer-side. That
# asymmetry is recorded rather than papered over with a check that cannot exist.
if [ -d "$REPO/plugins/ae/mcp-servers/codex" ]; then
  bad "an AE-owned codex bridge now exists — it must also import the shared contract, and this
        test's assumption that codex has no validatable boundary is out of date"
else
  ok "codex has no AE-owned bridge — no boundary to validate at, by transport not by omission"
fi

python3 - "$REPO" "$BUNDLE" "$SPEC" "$RUNNER" "$WORK" <<'PY'
import json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

repo, bundle, spec, runner, work = sys.argv[1:6]
failures = []
def ok(m):  print("  ok: %s" % m)
def bad(m): print("  FAIL: %s" % m, file=sys.stderr); failures.append(m)
def skip(m): print("  SKIP: %s" % m)

# --- payloads under test -------------------------------------------------------------------
# Boundary values are instantiated, not approximated: the EMPTY findings list and the MAXIMUM
# severity (P1) each get a case. "Nothing was found" and "the format was not followed" are
# different outcomes and a contract that conflates them makes the first unreportable.
CASES = [
    ("compliant, one P1 (max severity)", True,
     json.dumps({"findings": [{"severity": "P1", "file": "src/auth.js", "line": 13,
                               "summary": "SQL injection via string concatenation.",
                               "evidence": "const q = \"SELECT ...\" + user"}]})),
    ("compliant, empty findings list (boundary)", True,
     json.dumps({"findings": []})),
    ("non-compliant, missing required field `file`", False,
     json.dumps({"findings": [{"severity": "P2", "summary": "no file given"}]})),
    ("non-compliant, severity outside the allowed set", False,
     json.dumps({"findings": [{"severity": "P0", "file": "a.js", "summary": "invented level"}]})),
    ("non-compliant, prose instead of JSON", False,
     "I looked at the function and it concatenates user input into SQL, which is unsafe."),
]

# --- stub backend ---------------------------------------------------------------------------
# Returns whatever payload the current case names as the assistant message, in the OpenAI
# response shape. A canned server rather than a real model because the negative cases must be
# reproducible — "get a model to emit a bad severity on demand" is not a test.
current = {"payload": ""}

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        self.rfile.read(length)
        body = json.dumps({
            "id": "chatcmpl-stub", "object": "chat.completion",
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": current["payload"]}}],
        }).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a):  # keep the suite output clean
        pass

srv = HTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub_endpoint = "http://127.0.0.1:%d/v1" % srv.server_address[1]

# --- driving the bridge over stdio ----------------------------------------------------------
def call_bridge(args, env_extra=None, timeout=60):
    env = dict(os.environ)
    env.update(env_extra or {})
    p = subprocess.Popen(["node", bundle], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, text=True, bufsize=1, env=env)
    def send(o):
        p.stdin.write(json.dumps(o) + "\n"); p.stdin.flush()
    try:
        send({"jsonrpc": "2.0", "id": 1, "method": "initialize",
              "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                         "clientInfo": {"name": "t", "version": "0"}}})
        send({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
        send({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
              "params": {"name": "chat", "arguments": args}})
        deadline = threading.Event()
        threading.Timer(timeout, lambda: (deadline.set(), p.kill())).start()
        while True:
            line = p.stdout.readline()
            if not line:
                return None
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == 2:
                return msg.get("result", msg)
    finally:
        p.terminate()

def bridge_verdict(payload):
    current["payload"] = payload
    res = call_bridge({"model": "stub", "family": "stub", "endpoint": stub_endpoint,
                       "expect": "findings", "prompt": "review this"})
    if res is None:
        return None
    text = "".join(c.get("text", "") for c in res.get("content", []))
    try:
        doc = json.loads(text)
    except json.JSONDecodeError:
        return {"parsed": False, "raw": text, "isError": res.get("isError")}
    return {"parsed": True, "doc": doc, "isError": bool(res.get("isError"))}

def spec_verdict(payload):
    """The same payload through the authored spec. Non-JSON cannot reach the runner at all,
    which is itself the correct verdict — the contract asks for a JSON object."""
    path = os.path.join(work, "sample.json")
    try:
        json.loads(payload)
    except json.JSONDecodeError:
        return False
    with open(path, "w") as fh:
        fh.write(payload)
    return subprocess.run(["sh", runner, spec, path],
                          capture_output=True).returncode == 0

# --- deterministic half ---------------------------------------------------------------------
for label, expect_compliant, payload in CASES:
    v = bridge_verdict(payload)
    if v is None:
        bad("%s: bridge returned no response" % label)
        continue
    if not v["parsed"]:
        bad("%s: bridge result was not JSON: %r" % (label, v["raw"][:120]))
        continue
    doc = v["doc"]

    if doc.get("contract") != "findings":
        bad("%s: bridge did not report which contract it applied" % label)
        continue
    got = doc.get("compliant")
    if got is not expect_compliant:
        bad("%s: bridge reported compliant=%r, expected %r (violations=%r)"
            % (label, got, expect_compliant, doc.get("violations")))
        continue

    # isError must track compliance: a caller that only checks isError still learns the truth.
    if v["isError"] == expect_compliant:
        bad("%s: isError=%r contradicts compliant=%r" % (label, v["isError"], got))
        continue

    # The reply must come back UNTOUCHED in every branch. This is the anti-reshaping assertion
    # and it is the reason this test exists — a bridge that quietly repaired a bad severity
    # would satisfy every other check here.
    if doc.get("content") != payload:
        bad("%s: `content` was altered — the reply must be relayed verbatim" % label)
        continue

    if not expect_compliant:
        if not doc.get("violations"):
            bad("%s: reported non-compliant with no violations named" % label)
            continue
        if "findings" in doc:
            bad("%s: non-compliant reply still produced a `findings` list — that is reshaping"
                % label)
            continue

    # The authored spec must reach the same verdict as the runtime validator.
    if spec_verdict(payload) is not expect_compliant:
        bad("%s: the jq spec disagrees with the bridge — two validators, one contract" % label)
        continue

    ok("%s — bridge and spec agree" % label)

srv.shutdown()

# --- live half (skips when nothing answers) -------------------------------------------------
endpoint = os.environ.get("AE_OPENAI_COMPAT_ENDPOINT", "http://127.0.0.1:8000/v1")
import urllib.request, urllib.error
live = False
try:
    urllib.request.urlopen(endpoint.rstrip("/") + "/models", timeout=3).read()
    live = True
except Exception as e:
    skip("no backend answers at %s (%s) — the live assertion is not run; the deterministic "
         "cases above are unaffected" % (endpoint, type(e).__name__))

if live:
    try:
        models = json.loads(urllib.request.urlopen(endpoint.rstrip("/") + "/models", timeout=5).read())
        model = (models.get("data") or [{}])[0].get("id")
    except Exception:
        model = None
    if not model:
        skip("endpoint answered but served no model id — live assertion not run")
    else:
        res = call_bridge({"model": model, "family": "unknown", "endpoint": endpoint,
                           "expect": "findings", "system": "Role: security reviewer.",
                           "prompt": "Review this function in src/auth.js, which starts at line 12.\n\n"
                                     "function auth(user, pass) {\n"
                                     "  const q = \"SELECT * FROM users WHERE name='\" + user + \"'\";\n"
                                     "  return db.query(q);\n}\n"},
                          # Tightly bounded on purpose. This test is in the standard suite, and
                          # the endpoint's first-listed model may be a large one — a 180s budget
                          # turned a suite that ran in under a minute into a multi-minute wait.
                          # A slow backend degrades to SKIP; it does not get to hold the suite.
                          timeout=45)
        if res is None:
            skip("live call to %s produced no response within the budget — the deterministic "
                 "cases stand; a slow or absent backend does not hold the suite" % model)
        else:
            text = "".join(c.get("text", "") for c in res.get("content", []))
            try:
                doc = json.loads(text)
            except json.JSONDecodeError:
                doc = {}
            if doc.get("compliant") is True:
                ok("live: %s satisfied the contract (%d finding(s))"
                   % (model, len(doc.get("findings") or [])))
            elif doc.get("compliant") is False:
                # A real non-compliance is a genuine result about that backend, not a broken
                # test. It is reported and does not redden the suite — the assertion this test
                # owns is that non-compliance is DETECTED, which the deterministic half proves.
                skip("live: %s did not satisfy the contract (%s) — reported, not reshaped, which "
                     "is the required behaviour" % (model, doc.get("violations")))
            else:
                skip("live: %s returned no compliance verdict" % model)

sys.exit(1 if failures else 0)
PY
status=$?

[ "$status" = 0 ] || fail=1
[ "$fail" = 0 ] && echo "test-findings-format-compliance: PASS" \
               || echo "test-findings-format-compliance: FAIL" >&2
exit "$fail"
