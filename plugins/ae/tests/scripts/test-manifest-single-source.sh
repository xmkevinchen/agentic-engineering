#!/bin/sh
# test-manifest-single-source.sh — F-082 AC5.
#
# Two assertions, and they fail for different reasons:
#
#   1. No server is declared in more than one manifest. The host reference says a plugin
#      declares MCP servers in `.mcp.json` in the plugin root OR inline in plugin.json — the
#      same-name collision case is undocumented, so a plugin that does both is relying on
#      behaviour nobody promised. Two declarations also drift: AE's differed on the `codex`
#      entry for months and nothing noticed, because nothing compared them.
#
#   2. No manifest declares `sandbox_mode` or `approval_policy`. Launch-layer `-c` overrides do
#      not propagate into codex tool sessions, so those args asserted a containment the
#      tool-call layer never applied. A stated control nobody enforces is worse than an absent
#      one — it reads as enforcement to everyone downstream.
#
# Assertion 2 is a flat prohibition rather than "declared AND evidenced in a rollout file". The
# evidenced form was tried and dropped at plan review: checking that a second file *says* the
# value was observed only relocates the unsupported claim. Verifying it for real needs an
# identified rollout opened and diffed, and rollout files are session-scoped and transient, so
# that check cannot run reproducibly on another machine or in CI. Containment that is actually
# wanted goes through the per-call `config:` lever, where it is observable per call.
#
# Run: sh plugins/ae/tests/scripts/test-manifest-single-source.sh

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
PLUGIN_DIR="$REPO/plugins/ae"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

# Every file that can carry an `mcpServers` block, whether or not it exists today. Naming the
# absent one matters: the test must fail if `.mcp.json` comes back, not skip because it is gone.
MANIFESTS="$PLUGIN_DIR/.claude-plugin/plugin.json $PLUGIN_DIR/.mcp.json"

# 1. No server name in two manifests at once.
dupes="$(
  for m in $MANIFESTS; do
    [ -f "$m" ] || continue
    python3 - "$m" <<'PY'
import json, sys
with open(sys.argv[1]) as fh:
    for name in json.load(fh).get("mcpServers", {}):
        print(name)
PY
  done | sort | uniq -d
)"

present="$(for m in $MANIFESTS; do [ -f "$m" ] && echo "$m"; done | wc -l | tr -d ' ')"
if [ -z "$dupes" ]; then
  ok "no server declared in more than one manifest ($present manifest(s) carry an mcpServers block)"
else
  bad "declared in more than one manifest: $(echo "$dupes" | tr '\n' ' ')"
  bad "  the host documents one location OR the other; the collision case is undefined"
fi

# 2. Neither containment key appears anywhere in either manifest — not as an arg, not as a
#    key, not in an env block. Grepping the whole file rather than parsing one known shape is
#    deliberate: the claim was carried as `-c approval_policy=never` inside an args array,
#    which a key-only check would have walked straight past.
for key in sandbox_mode approval_policy; do
  hits=""
  for m in $MANIFESTS; do
    [ -f "$m" ] || continue
    grep -q "$key" "$m" && hits="$hits $(basename "$m")"
  done
  if [ -z "$hits" ]; then
    ok "no manifest declares $key"
  else
    bad "$key declared in:$hits — the tool-call layer does not apply it; use per-call config:"
  fi
done

# 3. The retained declaration must still name every server the plugin ships. Assertion 1 is
#    satisfiable by deleting both declarations, which would pass a test whose whole subject is
#    that servers stay reachable. Bundled servers are enumerated from the tree, not listed here,
#    so a new one is covered without editing this file.
#
#    A server is a directory carrying `dist/index.mjs` — something a manifest can actually exec.
#    Directory-presence alone was the earlier criterion and it was wrong the moment a shared
#    library landed beside the servers: `mcp-servers/shared/` holds the findings contract both
#    bridges import, is not a server, and cannot be declared in a manifest.
for dir in "$PLUGIN_DIR"/mcp-servers/*/; do
  [ -d "$dir" ] || continue
  [ -f "$dir/dist/index.mjs" ] || continue
  srv="$(basename "$dir")"
  found=0
  for m in $MANIFESTS; do
    [ -f "$m" ] && grep -q "\"$srv\"" "$m" && found=1
  done
  [ "$found" = 1 ] && ok "bundled server '$srv' is declared" \
                   || bad "bundled server '$srv' is in the tree but declared in no manifest"
done

# 4. No manifest `env` block references a `${CLAUDE_PLUGIN_OPTION_*}` variable.
#
#    Measured: an option the user never configured exports nothing, even with a default
#    declared in `userConfig`. Every `${...}` a manifest names is validated when the plugin is
#    installed, and one that does not resolve rejects the WHOLE server — so a declared-only
#    default takes the server down instead of supplying its value. The option is still readable;
#    it just has to be read in the server's own process, with a fallback, which is what both
#    bundled servers do.
#
#    This is the install-path failure mode: the reload path skips the validation, so the server
#    comes up for a developer working in the tree and is rejected for everyone who installs it.
#    Nothing else in the suite looks at the install path, which is why the same error was
#    observed, written down, and then shipped twice.
for m in $MANIFESTS; do
  [ -f "$m" ] || continue
  refs="$(python3 - "$m" <<'PY'
import json, re, sys
with open(sys.argv[1]) as fh:
    doc = json.load(fh)
for name, spec in doc.get("mcpServers", {}).items():
    for var, val in (spec.get("env") or {}).items():
        if re.search(r"\$\{CLAUDE_PLUGIN_OPTION_[A-Z0-9_]*\}", str(val)):
            print("%s.env.%s" % (name, var))
PY
)"
  if [ -z "$refs" ]; then
    ok "$(basename "$m"): no env block references a plugin option"
  else
    bad "$(basename "$m"): env block references a plugin option: $(echo "$refs" | tr '\n' ' ')"
    bad "  an unconfigured option resolves to nothing and the host rejects the whole server"
    bad "  at install time; read it in-process with a fallback instead"
  fi
done

[ "$fail" = 0 ] && echo "test-manifest-single-source: PASS" || echo "test-manifest-single-source: FAIL" >&2
exit "$fail"
