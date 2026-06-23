#!/bin/sh
# test-run-node-check.sh — F-051 AC1/AC2/AC3: hardened runner dispatch, validation, redcheck.
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/plugins/ae/scripts/run-node-check.sh"
[ -f "$RUN" ] || { echo "FAIL: run-node-check.sh not found at $RUN" >&2; exit 1; }

SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT; cd "$SB"
fail=0
assert() { if [ "$2" = "$3" ]; then echo "  ok: $1 (exit $3)"; else echo "  FAIL: $1 — expected $2, got $3" >&2; fail=1; fi; }
rc() { set +e; sh "$RUN" "$@" >/dev/null 2>&1; r=$?; set -e; echo "$r"; }

# --- AC1: file-contains dispatch ---
printf 'route billing here\n' > routes.txt
assert "file-contains match → pass"      0 "$(rc run file-contains target=routes.txt pattern=billing)"
assert "file-contains no-match → fail"    1 "$(rc run file-contains target=routes.txt pattern=nope)"
assert "file-contains missing file → fail" 1 "$(rc run file-contains target=absent.txt pattern=x)"

# --- AC1: json-field dispatch (skip if no jq) ---
if command -v jq >/dev/null 2>&1; then
  printf '{"routes":[{"name":"billing"}]}\n' > data.json
  assert "json-field truthy path → pass" 0 "$(rc run json-field target=data.json path=.routes[0].name)"
  assert "json-field null path → fail"    1 "$(rc run json-field target=data.json path=.missing)"
else
  echo "  skip: jq not available (json-field)"
fi

# --- AC1: command-output dispatch (allowlisted; run from $ROOT so `ls plugins/ae/scripts` resolves) ---
rcroot() { set +e; ( cd "$ROOT" && sh "$RUN" "$@" >/dev/null 2>&1 ); r=$?; set -e; echo "$r"; }
assert "command-output allowlisted, expect present → pass" 0 "$(rcroot run command-output cmd=ls-plugin-scripts expect=run-node-check.sh)"
assert "command-output allowlisted, expect absent → fail"  1 "$(rcroot run command-output cmd=ls-plugin-scripts expect=zzz-not-there)"

# --- AC2: validation ---
assert "unknown template → exit 2"            2 "$(rc run no-such-template target=x)"
assert "missing required param → exit 2"      2 "$(rc run file-contains target=routes.txt)"
assert "command-output non-allowlisted → exit 2" 2 "$(rc run command-output cmd=rm-rf-slash expect=x)"
# literal allowlist match (codex P2): a regex/glob or partial name must NOT resolve to a real entry
assert "command-output regex name (git.*) → exit 2"   2 "$(rc run command-output cmd=git.* expect=x)"
assert "command-output partial name (git-diff) → exit 2" 2 "$(rc run command-output cmd=git-diff expect=x)"
assert "bad param form (no =) → exit 2"       2 "$(rc run file-contains targetx pattern=y)"

# --- AC3: redcheck (red-before-green) bites + catches theater ---
assert "file-contains redcheck (real pattern) bites → 0" 0 "$(rc redcheck file-contains target=routes.txt pattern=billing)"
assert "command-output redcheck (real expect) bites → 0" 0 "$(rc redcheck command-output cmd=ls-plugin-scripts expect=billing)"
if command -v jq >/dev/null 2>&1; then
  assert "json-field redcheck (real path) bites → 0"      0 "$(rc redcheck json-field target=data.json path=.routes[0].name)"
  # tautological path truthy on {} → theater caught
  assert "json-field redcheck tautology (path=true) → theater 1" 1 "$(rc redcheck json-field target=data.json path=true)"
fi

[ "$fail" = 0 ] && echo "ok test-run-node-check" || { echo "test-run-node-check FAILED" >&2; exit 1; }
