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
    told = ("to the file path the caller names" in text
            and "Write the file before you return" in text)
    if "Write" in tools and told:
        ok(f"close-out seat {angle} is granted Write and told to use it")
    elif "Write" not in tools:
        bad(f"close-out seat {angle} is told to write a file but is not granted Write",
            f"{relative}: {tools.strip() or 'no tools: line'}")
    else:
        bad(f"close-out seat {angle} can write a file but is never told to",
            f"{relative}: a grant with no instruction produces nothing")

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
    stage = pathlib.Path(relative).parent.name
    if "returned-<id>.md" not in text:
        bad(f"{stage} never names returned-<id>.md",
            f"{relative}: this leg {role}, and nothing says so")
        continue
    body = " ".join(text.split())
    if stage == "analyze" and "**delete the file**" not in body:
        bad("analyze names the tag but never tears it off",
            f"{relative}: a tag left on a question that has passed is wrong information")
    elif stage == "go" and "means that id is back at step 1, not here" not in body:
        bad("go names the tag but does not route on it",
            f"{relative}: a tag nothing acts on is not a reader")
    else:
        ok(f"{stage} {role}")

# --- AC1: every round leaves its output on disk -------------------------------------------
#
# Nothing resumes across rounds: the next round reads what the last one wrote. So anything a
# round produces that is not written down cannot reach the round that needs it. Three artifact
# classes have gone missing in real runs — a seat's own answer, the composite the correction
# round produces, and the fact that a seat could not answer at all.

discuss = read("plugins/ae/skills/discuss/SKILL.md")
if discuss is not None:
    if "pass-1/" in discuss and "There is never a bare `round-N/`" in " ".join(discuss.split()):
        ok("the directory layout shows the pass level, so a pass is countable from disk")
    else:
        bad("the directory layout has no pass level",
            "plugins/ae/skills/discuss/SKILL.md: a bare round-N/ cannot say which pass it was")

    if "The composite is a file too, at `round-2/composite.md`" in " ".join(discuss.split()):
        ok("the correction round's composite is a named file")
    else:
        bad("the correction round's composite is named as a deliverable but given no path",
            "plugins/ae/skills/discuss/SKILL.md: a deliverable with no path is not on disk")

    if "could not answer" in discuss or "cannot answer" in discuss:
        ok("a seat that produced no answer still leaves the absence on disk")
    else:
        bad("nothing records a seat that could not answer",
            "plugins/ae/skills/discuss/SKILL.md: a silent gap reads as a seat nobody asked")

# --- AC2: the sort asks one question and leaves no residue --------------------------------
#
# The sort used to pose a two-way question and then give premise-wrong / everything-else rules.
# The shapes differed, and the gap was not academic: three readers were given one real finding
# and the same protocol, and the cross-family one routed it differently from the other two.
#
# Prose wraps, so every comparison here is against the text with its whitespace collapsed.

if discuss is not None:
    flat = " ".join(discuss.split())

    if "does it say the premise is wrong, or does it say the answer can be better?" in flat:
        bad("the sort still poses a two-way question over premise-wrong / everything-else rules",
            "plugins/ae/skills/discuss/SKILL.md: the question and the rules have different shapes")
    else:
        ok("the sort no longer poses a question whose shape differs from its own rules")

    if "There is no third class" in flat:
        ok("the sort names no third class, so every finding has a destination")
    else:
        bad("the sort leaves a residue between its two exits",
            "plugins/ae/skills/discuss/SKILL.md: a finding that fits neither branch has nowhere to go")

    binds_target = "question's own premise" in flat
    binds_modality = "merely unconfirmed or at risk of failing" in flat
    if binds_target and binds_modality:
        ok("the sort binds both loose words — whose premise, and asserted how strongly")
    else:
        missing = []
        if not binds_target:
            missing.append("whose premise")
        if not binds_modality:
            missing.append("asserted false rather than unconfirmed")
        bad("the sort leaves a word loose that readers have already split on: "
            + " and ".join(missing),
            "plugins/ae/skills/discuss/SKILL.md")

# --- AC4 + AC5: the loop ends, and what it still objected to survives ----------------------
#
# The written stop was a judgement about what a pass produced, and a pass never runs out of
# things to produce: each rewrite of the composite is fresh surface for the next objection. A
# reader handed the protocol and a sequence of always-new findings reported that nothing in the
# file ever ends it, and that the only sentence mentioning "the loop's bound" pointed at a
# number the file never defined.

if discuss is not None:
    if "stop at two passes" in flat:
        ok("the loop has a stated bound, not only a judgement about what came back")
    else:
        bad("nothing in the close-out ends the loop on a count",
            "plugins/ae/skills/discuss/SKILL.md: a content stop can be starved forever")

    if ("Count the completed `pass-N/` directories on disk" in flat
            and "completed means all four angle files are there" in flat):
        ok("the bound is counted from disk, and only from completed passes")
    else:
        bad("the bound names no source, or counts passes that never finished",
            "plugins/ae/skills/discuss/SKILL.md: a count held in the session dies with it, and a "
            "half-finished pass would fire the bound early")

    if "Both ways out owe the same thing" in flat:
        ok("the objection-recording obligation attaches to the bound, not only to the content stop")
    else:
        bad("a record written because the count ran out owes no objection",
            "plugins/ae/skills/discuss/SKILL.md: that is the exit most likely to leave one standing")

analyze = read("plugins/ae/skills/analyze/SKILL.md")
if analyze is not None:
    if "question ids, like `F-NNN`, are never reused" in " ".join(analyze.split()):
        ok("a re-posed question gets a new id, so the pass count starts from zero")
    else:
        bad("a returned question can be re-posed under the same id",
            "plugins/ae/skills/analyze/SKILL.md: the old pass directories survive the return, so "
            "the bound would fire before the re-posed question argued anything")

print()
print(f"  {len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
PY
