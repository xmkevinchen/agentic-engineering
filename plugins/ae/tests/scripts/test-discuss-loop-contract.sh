#!/bin/sh
# test-discuss-loop-contract.sh — F-095.
#
# The discuss stage's control flow lives in prose across three skills and seven agent
# definitions. Each rule has several legs — a party that writes a thing, a party that reads it,
# a party that discharges it — and a rule loses its meaning the moment one leg goes, silently,
# because prose does not fail to compile.
#
# This is a liveness net over those legs. It asserts the names are present in the files that
# must carry them. It does NOT assert the protocol terminates, or that two readers route a
# finding the same way: those are properties of a run, and the plan names a judged check for
# each instead of an automated one that would only restate the prose back to itself.
#
# Run: sh plugins/ae/tests/scripts/test-discuss-loop-contract.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"

exec python3 - "$REPO" <<'PY'
import pathlib, re, sys

REPO = pathlib.Path(sys.argv[1])
passed, failed = [], []


def ok(message):
    passed.append(message)
    print(f"  ok: {message}")


def bad(message, detail=""):
    failed.append(message)
    print(f"  FAIL: {message}", file=sys.stderr)
    if detail:
        print(f"       {detail}", file=sys.stderr)


def read(relative):
    path = REPO / relative
    if not path.is_file():
        bad(f"missing file: {relative}")
        return None
    return path.read_text()


def frontmatter(text):
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    return match.group(1) if match else ""


# --- AC1: a seat that is told to write a file must be able to write one -------------------
#
# The close-out readers are instructed by their own definitions to write their findings to a
# path the caller names. Without the tool that is an instruction the agent cannot follow, and
# it has already failed exactly that way once, reporting that it could not write the file its
# definition told it to.

CLOSE_OUT = ["adversarial", "regret", "strategic", "scope-reducer"]

for angle in CLOSE_OUT:
    relative = f"plugins/ae/agents/workflow/doodlestein-{angle}.md"
    text = read(relative)
    if text is None:
        continue
    tools = ""
    for line in frontmatter(text).splitlines():
        if line.startswith("tools:"):
            tools = line
    if "Write" in tools:
        ok(f"close-out seat {angle} is granted Write")
    else:
        bad(f"close-out seat {angle} is told to write a file but is not granted Write",
            f"{relative}: {tools.strip() or 'no tools: line'}")

# The proxy seats front a backend and have always returned their findings in a reply. A reply
# is not a round's output: the next round reads files. Each must be told to write its own.

PROXIES = ["codex-proxy", "gemini-proxy", "openai-compat-proxy"]

for proxy in PROXIES:
    relative = f"plugins/ae/agents/workflow/{proxy}.md"
    text = read(relative)
    if text is None:
        continue
    has_section = "## Where your answer goes" in text
    has_rule = "write your answer there before you return it" in text.lower()
    if has_section and has_rule:
        ok(f"proxy seat {proxy} is told to write its own file at a caller-named path")
    else:
        bad(f"proxy seat {proxy} is never told to write its own file",
            f"{relative}: a returned reply is not a round's written output")

# --- AC3: the return tag has a writer, a reader and a discharger --------------------------
#
# A question that ran and was sent back is byte-identical on disk to one nobody started, unless
# something writes a tag. The tag is worth nothing unless something reads it, and it becomes a
# lie unless something tears it off. Three legs; losing any one is silent.

RETURN_TAG_LEGS = [
    ("plugins/ae/skills/discuss/SKILL.md", "writes it on a premise-wrong exit"),
    ("plugins/ae/skills/go/SKILL.md", "reads it and routes that id back to ANALYZE"),
    ("plugins/ae/skills/analyze/SKILL.md", "discharges it and deletes it"),
]

for relative, role in RETURN_TAG_LEGS:
    text = read(relative)
    if text is None:
        continue
    if "returned-<id>.md" in text:
        ok(f"{pathlib.Path(relative).parent.name} {role}")
    else:
        bad(f"{pathlib.Path(relative).parent.name} never names returned-<id>.md",
            f"{relative}: this leg {role}, and nothing says so")

print()
print(f"  {len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
PY
