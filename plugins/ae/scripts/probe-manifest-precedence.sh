#!/bin/bash
# probe-manifest-precedence.sh — which manifest's `mcpServers` command did the host execute?
#
# AE declares MCP servers twice: `plugins/ae/.mcp.json` (call it A) and the `mcpServers` block
# in `plugins/ae/.claude-plugin/plugin.json` (B). Which one is in force was unestablished, and
# the question is load-bearing: deleting the losing block on a wrong answer would remove the
# only declaration a user actually runs.
#
# READ-BACK ONLY — this script modifies nothing. The plan originally proposed arming each
# manifest with a distinct wrapper command that appends a marker before `exec`ing the real
# binary. That is unnecessary here and strictly worse: the host records its choice itself, in
# the argv of the process it spawned, and `ps` reads it. A wrapper would perturb the thing
# being measured and would need its own positive control to distinguish "neither fired" from
# "the wrapper is broken". Reading argv has no such ambiguity — either a manifest's complete
# command line is present or it is not.
#
# Launch-layer `-c` flags were excluded as a discriminator elsewhere because they do not reach
# codex tool sessions. That is a fact about whether codex honours the flag. This script asks a
# different question: what did the host type. Only the second one is manifest precedence.
#
# MATCHING IS EXACT, and that is not a detail. `.mcp.json` declares `codex mcp-server`, which
# is a leading substring of `plugin.json`'s `codex mcp-server -c approval_policy=never -c
# sandbox_mode=read-only`. Under substring matching every B process also reads as an A process
# and the probe reports BOTH — a false non-discriminating result, which is the one outcome that
# routes the caller to the conservative branch and stops the deletion. So an observed command
# must equal a declaration in full, not contain it.
#
# HONEST SCOPE — what this cannot see:
#   * A server whose two declarations are identical cannot discriminate, no matter how cleanly
#     it is observed. It is reported NON-DISCRIMINATING, never as agreement.
#   * A host that never respawned yields a stale reading. Distinct start times are reported so
#     the caller can see whether a reload actually happened; repeated observations of one pid
#     are reported as one reading rather than presented as confirmation.
#   * `codex` carries no filesystem path, so it cannot say which install path the observation
#     covers. The leg is read from any path-bearing server, discriminating or not.
#   * Nothing here says what the running server then did with the flag.
#
# Exit 0 = at least one discriminating server was positively identified in a live process.
# Exit 1 = no identification (no discriminating server, or the host has not spawned one).

set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
MCP_JSON="$REPO/plugins/ae/.mcp.json"
PLUGIN_JSON="$REPO/plugins/ae/.claude-plugin/plugin.json"

for f in "$MCP_JSON" "$PLUGIN_JSON"; do
  [ -f "$f" ] || { echo "[precedence] missing manifest: $f"; exit 1; }
done

python3 - "$MCP_JSON" "$PLUGIN_JSON" "$REPO" <<'PY'
import json, re, subprocess, sys

mcp_json, plugin_json, repo = sys.argv[1], sys.argv[2], sys.argv[3]

def declarations(path, label):
    with open(path) as fh:
        block = json.load(fh).get("mcpServers", {})
    out = {}
    for name, spec in block.items():
        argv = " ".join([spec.get("command", "")] + spec.get("args", []))
        # The host substitutes `${VAR}` before exec, so those spans match anything; every
        # other character must match literally, and the whole string must match end to end.
        pattern = "".join(
            ".*" if part.startswith("${") else re.escape(part)
            for part in re.split(r"(\$\{[^}]*\})", argv)
        )
        out[name] = (argv, re.compile(r"\A" + pattern + r"\Z"))
    return out

A = declarations(mcp_json, "A")
B = declarations(plugin_json, "B")

# `ps` is read here rather than piped in: this program arrives on stdin itself (`python3 -`),
# so a pipe would be swallowed by the interpreter before a single line reached `sys.stdin`.
ps_out = subprocess.run(["ps", "-eo", "pid=,lstart=,command="],
                        capture_output=True, text=True).stdout

# `ps -eo pid=,lstart=,command=` → pid, then a five-token lstart, then the command.
procs = []
for line in ps_out.splitlines():
    parts = line.rstrip("\n").split(maxsplit=6)
    if len(parts) < 7:
        continue
    pid, started, cmd = parts[0], " ".join(parts[1:6]), parts[6].strip()
    procs.append((pid, started, cmd))

print("[precedence] read-back only — no manifest is modified; argv is the host's own record")
print("[precedence] manifests: A=plugins/ae/.mcp.json  B=plugins/ae/.claude-plugin/plugin.json")
print()

def matches(decl, cmd):
    return decl is not None and decl[1].match(cmd) is not None

# `observed` counts discriminating servers that matched a live process at all; `exclusive`
# counts those that resolved to exactly one manifest. BOTH and AMBIGUOUS are observations, not
# failures to observe, and collapsing them into the same exit as "nothing is running" would
# describe the conservative-branch outcome as an absence of data.
observed = 0
exclusive = 0
leg = None

# Leg detection runs over every process, not over matched declarations. A `bash -c exec node
# …` entry replaces itself, so the surviving process carries the node argv rather than the
# declared one and would never match a manifest line — and the only DISCRIMINATING server here
# (codex) carries no path at all. What names the leg is the tree any bundled server runs from.
for _pid, _started, cmd in procs:
    if "/mcp-servers/" not in cmd:
        continue
    if "/.claude/plugins/cache/" in cmd:
        leg = "installed"
    elif repo in cmd and leg != "installed":
        leg = "dev"

for name in sorted(set(A) | set(B)):
    a, b = A.get(name), B.get(name)

    if a is None or b is None:
        print("  %-16s DECLARED IN ONE MANIFEST ONLY (%s) — cannot discriminate"
              % (name, "A" if a else "B"))
        continue
    if a[0] == b[0]:
        print("  %-16s NON-DISCRIMINATING — both manifests declare the same argv" % name)
        continue

    print("  %-16s DISCRIMINATING" % name)
    print("    A  %s" % a[0])
    print("    B  %s" % b[0])

    hits = []
    for pid, started, cmd in procs:
        hit_a, hit_b = matches(a, cmd), matches(b, cmd)
        if hit_a and hit_b:
            # Both declarations match one command in full. With exact anchoring this needs a
            # `${VAR}` span in one of them wide enough to swallow the other, so the pair is not
            # really discriminating however different the two strings look. Reported, never
            # resolved by picking one — silently preferring A is how the prefix bug read.
            print("    observed  pid %-7s %s  -> AMBIGUOUS (matches both declarations)"
                  % (pid, started))
            hits.append((pid, started, "?"))
        elif hit_a or hit_b:
            label = "A" if hit_a else "B"
            print("    observed  pid %-7s %s  -> %s" % (pid, started, label))
            hits.append((pid, started, label))

    if not hits:
        print("    RESULT: neither — no live process matches either declaration in full")
        print("            (a reload may not have happened; nothing is concluded from this)")
        print()
        continue

    labels = {h[2] for h in hits}
    if "?" in labels:
        print("    RESULT: AMBIGUOUS — a live command matches both declarations in full;")
        print("            these two are not a usable discriminator")
    elif labels == {"A", "B"}:
        print("    RESULT: BOTH — each manifest has a live process; precedence is not exclusive")
    else:
        won = labels.pop()
        origin = {"A": "plugins/ae/.mcp.json",
                  "B": "plugins/ae/.claude-plugin/plugin.json"}[won]
        print("    RESULT: %s (%s)" % (won, origin))
        exclusive += 1
    observed += 1

    # Independent repetitions, not one reading re-counted: distinct start times are what
    # show the host respawned rather than that `ps` listed a parent and its child.
    starts = sorted({h[1] for h in hits})
    print("    respawn evidence: %d process(es) at %d distinct start time(s)%s"
          % (len(hits), len(starts), "" if len(starts) > 1 else
             " — one start time is a single reading, not a confirmed respawn"))
    for s in starts:
        print("      %s" % s)
    print()

if leg == "dev":
    print("[precedence] install leg: dev — processes exec from %s (directory-source marketplace)" % repo)
elif leg == "installed":
    print("[precedence] install leg: installed — processes exec from ~/.claude/plugins/cache/")
else:
    print("[precedence] install leg: unknown — no path-bearing server observed; argv alone cannot name it")

if observed == 0:
    print("[precedence] nothing observed. Either no manifest declares a discriminating server,")
    print("             or the host has not spawned one since the last reload.")
    sys.exit(1)

print("[precedence] observed on %d discriminating server(s); %d resolved to a single manifest"
      % (observed, exclusive))
if exclusive == 0:
    print("             no exclusive winner — this is the conservative-branch outcome, not a")
    print("             missing measurement: keep both declarations and converge them.")
PY
