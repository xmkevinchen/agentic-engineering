#!/bin/sh
# test-frontmatter-parse-regression.sh — F-083 AC1/AC2.
#
# The corpus shipped six definitions whose frontmatter did not parse. Five SKILL.md files ended
# their description with `Recommended: Sonnet or above`; one agent declared
# `probe: [ -n "${GEMINI_API_KEY:-}" ] && ...`. To YAML the first is a mapping key inside a
# plain scalar and the second is a flow sequence with trailing junk. Both are parse errors, and
# the host's answer to a parse error is to load the definition with EMPTY metadata — `model`,
# `effort`, `tools` and `user-invocable` all declared, none in force, nothing said at the point
# of use. `claude plugin validate` was the only thing that ever reported it.
#
# So this test has two halves, and the negative half is the load-bearing one:
#
#   1. FIXTURES, built at runtime, one per malformation class plus a quoted control for each.
#      A checker that has never been observed rejecting the bad shape is a checker by assertion.
#      The fixtures are written here rather than stored, so they cannot be quietly repaired by
#      someone fixing "a broken file in the test tree".
#   2. The live corpus: every skill and agent definition parses to a non-empty mapping, and the
#      six repaired definitions still carry the exact fields they declared before the repair.
#      Quoting a scalar must not change what the scalar says.
#
# The parser is required, not optional. A grep-shaped fallback would pass the exact corpus this
# test exists for, so an absent parser is a failure.
#
# Run: sh plugins/ae/tests/scripts/test-frontmatter-parse-regression.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

command -v python3 >/dev/null 2>&1 || {
  bad "python3 not found — the frontmatter contract cannot be parsed, so this test fails closed"
  echo "test-frontmatter-parse-regression: FAIL" >&2; exit 1; }
python3 -c 'import yaml' >/dev/null 2>&1 || {
  bad "PyYAML not importable — a text-shaped substitute would pass the corpus this test is about"
  echo "test-frontmatter-parse-regression: FAIL" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# parses <file> -> 0 if the leading frontmatter block loads as a non-empty mapping
parses() {
  python3 - "$1" <<'PY'
import sys, yaml
lines = open(sys.argv[1], encoding="utf-8").read().split("\n")
if not lines or lines[0] != "---":
    sys.exit(1)
close = next((i for i in range(1, len(lines)) if lines[i] == "---"), None)
if close is None:
    sys.exit(1)
try:
    parsed = yaml.safe_load("\n".join(lines[1:close]))
except yaml.YAMLError:
    sys.exit(1)
sys.exit(0 if isinstance(parsed, dict) and parsed else 1)
PY
}

# --- 1. Runtime fixtures, one pair per malformation class ----------------------------------

# Class A: an unquoted embedded colon in a Skill description. `: ` inside a plain scalar reads
# as a nested mapping key, which is the exact shape five skills shipped.
cat > "$TMP/colon-bad.md" <<'EOF'
---
name: think
description: Deep multi-step reasoning for hard bugs. Recommended: Sonnet or above
user-invocable: true
effort: high
---
body
EOF
cat > "$TMP/colon-good.md" <<'EOF'
---
name: think
description: "Deep multi-step reasoning for hard bugs. Recommended: Sonnet or above"
user-invocable: true
effort: high
---
body
EOF

# Class B: an unquoted shell-like `probe:` scalar. A leading `[` opens a YAML flow sequence and
# everything after the matching `]` is trailing junk.
cat > "$TMP/probe-bad.md" <<'EOF'
---
name: gemini-proxy
description: Google family representative.
model: haiku
probe: [ -n "${GEMINI_API_KEY:-}" ] && [ -f "$AE_PLUGIN_ROOT/mcp-servers/gemini/dist/index.mjs" ]
---
body
EOF
cat > "$TMP/probe-good.md" <<'EOF'
---
name: gemini-proxy
description: Google family representative.
model: haiku
probe: '[ -n "${GEMINI_API_KEY:-}" ] && [ -f "$AE_PLUGIN_ROOT/mcp-servers/gemini/dist/index.mjs" ]'
---
body
EOF

if parses "$TMP/colon-bad.md"; then
  bad "fixture: an unquoted embedded colon in a description was accepted — this is the shape five skills shipped"
else
  ok "fixture: an unquoted embedded colon in a description is rejected"
fi
if parses "$TMP/colon-good.md"; then
  ok "control: the same description, quoted, parses"
else
  bad "control: a quoted description was rejected — the repair itself would not pass"
fi
if parses "$TMP/probe-bad.md"; then
  bad "fixture: an unquoted shell-like probe: [...] scalar was accepted"
else
  ok "fixture: an unquoted shell-like probe: [...] scalar is rejected"
fi
if parses "$TMP/probe-good.md"; then
  ok "control: the same probe, single-quoted, parses"
else
  bad "control: a single-quoted probe was rejected — the repair itself would not pass"
fi

# Grep-only field presence cannot separate the two: both files in a pair carry `description:`
# and `probe:` at the start of a line. Asserted so a later "simplification" back to grep is a
# visible test failure rather than a silent loss of the whole point.
if grep -q '^description:' "$TMP/colon-bad.md" && grep -q '^description:' "$TMP/colon-good.md" &&
   grep -q '^probe:' "$TMP/probe-bad.md" && grep -q '^probe:' "$TMP/probe-good.md"; then
  ok "grep-only presence cannot tell the malformed fixture from its control — a parser is required"
else
  bad "fixture pairs are not grep-indistinguishable; the point they make is weaker than intended"
fi

# --- 2. The live corpus ---------------------------------------------------------------------

corpus="$(python3 - "$REPO" <<'PY'
import sys, pathlib, yaml

repo = pathlib.Path(sys.argv[1])
defs = sorted((repo / "plugins/ae/skills").glob("*/SKILL.md")) + \
       sorted((repo / "plugins/ae/agents").rglob("*.md"))
if not defs:
    print("FAIL no skill or agent definition found — this half asserted nothing")
    raise SystemExit(1)

bad = []
for path in defs:
    rel = path.relative_to(repo)
    lines = path.read_text(encoding="utf-8", errors="replace").split("\n")
    if not lines or lines[0] != "---":
        bad.append(f"FAIL {rel}: no leading --- fence")
        continue
    close = next((i for i in range(1, len(lines)) if lines[i] == "---"), None)
    if close is None:
        bad.append(f"FAIL {rel}: leading frontmatter never closed")
        continue
    try:
        parsed = yaml.safe_load("\n".join(lines[1:close]))
    except yaml.YAMLError as exc:
        bad.append(f"FAIL {rel}: does not parse — the host loads it with empty metadata "
                   f"({str(exc).splitlines()[0][:110]})")
        continue
    if not isinstance(parsed, dict) or not parsed:
        bad.append(f"FAIL {rel}: parses to {type(parsed).__name__}, not a non-empty mapping")

# The six the repair touched must still SAY what they said. Quoting is a syntax change; a
# description that lost its trailing clause, or a probe whose command changed, would pass every
# check above while being a different declaration.
expected = {
    "plugins/ae/skills/think/SKILL.md": {
        "name": "think", "effort": "high", "user-invocable": True,
        "description": "Deep multi-step reasoning for complex architecture decisions, hard bugs, or performance analysis. Recommended: Sonnet or above"},
    "plugins/ae/skills/plan/SKILL.md": {
        "name": "plan", "model": "opus", "effort": "high", "user-invocable": True,
        "description": "Generate a feature plan with acceptance criteria + plan review. Recommended: Sonnet or above"},
    "plugins/ae/skills/review/SKILL.md": {
        "name": "review", "model": "opus", "effort": "xhigh", "user-invocable": True,
        "description": "Deep multi-agent review + fixup (feature completion gate). Recommended: Sonnet or above"},
    "plugins/ae/skills/work/SKILL.md": {
        "name": "work", "effort": "high", "user-invocable": True,
        "description": "Execute plan (TDD + commit + review, pre-checks chain). Recommended: Sonnet or above"},
    "plugins/ae/skills/discuss/SKILL.md": {
        "name": "discuss", "model": "opus", "effort": "high", "user-invocable": True,
        "description": "Structured design discussion (create topics or continue pending ones, all decisions persisted). Recommended: Sonnet or above"},
    "plugins/ae/agents/workflow/gemini-proxy.md": {
        "name": "gemini-proxy", "model": "haiku", "effort": "low", "color": "purple",
        "omitClaudeMd": True,
        "probe": '[ -n "${GEMINI_API_KEY:-}" ] && [ -f "$AE_PLUGIN_ROOT/mcp-servers/gemini/dist/index.mjs" ]'},
}
for rel, fields in expected.items():
    path = repo / rel
    if not path.exists():
        bad.append(f"FAIL {rel}: expected definition is missing")
        continue
    lines = path.read_text(encoding="utf-8").split("\n")
    close = next((i for i in range(1, len(lines)) if lines[i] == "---"), None)
    try:
        parsed = yaml.safe_load("\n".join(lines[1:close])) if close else None
    except yaml.YAMLError:
        parsed = None
    if not isinstance(parsed, dict):
        bad.append(f"FAIL {rel}: no projection to compare intended fields against")
        continue
    for key, want in fields.items():
        got = parsed.get(key, "<absent>")
        if got != want:
            bad.append(f"FAIL {rel}: '{key}' projects as {got!r}, intended {want!r} — "
                       f"quoting a scalar must not change what it says")

if bad:
    print("\n".join(bad))
    raise SystemExit(1)
print(f"OK {len(defs)} definition(s) parse to a non-empty projection")
print(f"OK {len(expected)} repaired definition(s) still project their intended fields")
PY
)" && corpus_rc=0 || corpus_rc=1

printf '%s\n' "$corpus" | while IFS= read -r line; do
  case $line in
    OK\ *)   echo "  ok: ${line#OK }" ;;
    FAIL\ *) echo "  FAIL: ${line#FAIL }" >&2 ;;
    *)       [ -n "$line" ] && echo "  $line" >&2 ;;
  esac
done
[ "$corpus_rc" -eq 0 ] || fail=1

if [ "$fail" -eq 0 ]; then
  echo "test-frontmatter-parse-regression: PASS"
else
  echo "test-frontmatter-parse-regression: FAIL" >&2
fi
exit "$fail"
