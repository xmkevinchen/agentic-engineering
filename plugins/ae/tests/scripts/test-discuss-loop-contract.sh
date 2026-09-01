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

# --- F-097: the rounds-one-and-two seat is a definition on disk, not a pick made at spawn --
#
# The stage's first two rounds used to be filled by whichever agent the caller reached for, so
# two runs of one stage could be answered by parties with different capabilities. The seat is
# now one definition, and what it is made of has to be readable from the file: the grant it
# holds, the model it runs as, the jobs it is told to do, and nothing set that does nothing.
#
# Text on disk is all this can check. Whether `model:` and `tools:` arrive on the spawned agent
# is a property of a spawn, and no assertion here stands in for one.

SEAT = "plugins/ae/agents/workflow/discuss-seat.md"
SEAT_KEYS = ["name", "description", "tools", "model"]

seat = read(SEAT)
if seat is not None:
    seat_fields = {}
    for line in frontmatter(seat).splitlines():
        if re.match(r"^[A-Za-z][A-Za-z0-9_-]*:", line):
            key, _, value = line.partition(":")
            seat_fields[key.strip()] = value.strip()

    if seat_fields.get("tools") == "Read, Write, Bash":
        ok("the discuss seat is granted exactly Read, Write, Bash")
    else:
        bad("the discuss seat's grant is not Read, Write, Bash",
            f"{SEAT}: tools: {seat_fields.get('tools') or '(no tools: line)'}")

    if seat_fields.get("model") == "opus":
        ok("the discuss seat declares model: opus")
    else:
        bad("the discuss seat does not declare model: opus",
            f"{SEAT}: model: {seat_fields.get('model') or '(no model: line)'}")

    # An allowlist, not a denylist. Definitions here already carry keys the host does not read,
    # so forbidding the three known inert ones would wave through the next one.
    if sorted(seat_fields) == sorted(SEAT_KEYS):
        ok("the discuss seat's frontmatter is exactly name, description, tools, model")
    else:
        extra = [k for k in seat_fields if k not in SEAT_KEYS]
        missing = [k for k in SEAT_KEYS if k not in seat_fields]
        bad("the discuss seat's frontmatter is not exactly the four keys that take effect",
            f"{SEAT}: unexpected {extra or '(none)'}, absent {missing or '(none)'}")

    flat_seat = " ".join(seat.split()).lower()

    if "## Where your answer goes" in seat and "write your answer there before you return it" in flat_seat:
        ok("the discuss seat is told to write its own file at a caller-named path")
    else:
        bad("the discuss seat is never told to write its own file",
            f"{SEAT}: the next round reads files, and a returned reply is not one")

    if "round one" in flat_seat and "round two" in flat_seat:
        ok("the discuss seat's body describes both of the rounds it fills")
    else:
        bad("the discuss seat's body describes only one of the two rounds it fills",
            f"{SEAT}: the rounds differ in the body's task text, so a body naming one fills one")

    if "curl" in flat_seat and "unchecked" in flat_seat:
        ok("the discuss seat's body names the outside-source route and what an unopened claim is marked")
    else:
        bad("the discuss seat's body leaves the outside-source route unnamed",
            f"{SEAT}: an untold Bash-only seat abstains where it could have checked")

# --- F-097: the skill names the seat, and keeps what the paragraph already said ------------
#
# Naming the definition is what stops the seat being picked at spawn time. It goes into the
# paragraph that already describes a same-family seat, not over it: that paragraph carries the
# rule that a record made with a seat sharing your prior must disclose it, and an edit that
# replaced the paragraph would take the disclosure with it. One assertion holds both halves —
# the second string is green today, so on its own it is a check nobody could watch fail.

if discuss is not None:
    names_seat = "ae:workflow:discuss-seat" in discuss
    keeps_disclosure = "say that it shared the prior" in flat
    if names_seat and keeps_disclosure:
        ok("the same-family seat is named as a definition, and its shared-prior rule survived")
    elif not names_seat:
        bad("the stage names no agent for rounds one and two",
            "plugins/ae/skills/discuss/SKILL.md: a seat nobody names is a seat chosen at spawn")
    else:
        bad("naming the seat took the shared-prior disclosure with it",
            "plugins/ae/skills/discuss/SKILL.md: the id was added by replacing the paragraph")

# --- F-097: a finished run can say what answered each round -------------------------------
#
# A seat cannot report its own agent type or the settings its definition declared — a spawn on a
# definition declaring `model: sonnet` reported no model-naming sentence in its context at all.
# So the obligation is the caller's, and it is stage-level: one rule covers every seat in a
# round rather than each definition carrying its own.

if discuss is not None:
    if "which agent held the seat" in flat:
        ok("the caller records which agent held each seat, not only which backend answered")
    else:
        bad("a finished run cannot say which agent answered a round",
            "plugins/ae/skills/discuss/SKILL.md: backend and model do not name the seat or its "
            "declared settings, and the seat cannot report them itself")

# --- F-097: nothing is configured that does nothing ---------------------------------------
#
# `omitClaudeMd` is not effective for plugin agents and is not in the published field list
# (`docs/references/claude-code-plugin-api.md:57`). A field that has been read by nothing for
# months is worse than absent: it reads as a setting somebody chose, and the next reader budgets
# for a cost it does not remove. Repo-wide rather than over one file, because a criterion about
# what a definition sets is not met by keeping the newest definition clean.

inert = []
for path in sorted((REPO / "plugins/ae/agents").rglob("*.md")):
    for line in frontmatter(path.read_text()).splitlines():
        if line.startswith("omitClaudeMd:"):
            inert.append(f"{path.relative_to(REPO)}: {line.strip()}")
if inert:
    bad("a definition sets omitClaudeMd, which the host does not read",
        "; ".join(inert))
else:
    ok("no definition sets omitClaudeMd, a field measured to do nothing")

# --- F-097: what a seat is given matches what it is asked to do ---------------------------
#
# The Google seat is told to report the model that actually answered and to fall back when one
# is unavailable, and its backend implements a `models` tool for exactly that
# (`plugins/ae/mcp-servers/gemini/src/index.ts:290`). Without the grant it has to guess: it has
# already reported a model as no longer available that the model list disproved.

google_seat = read("plugins/ae/agents/workflow/gemini-proxy.md")
if google_seat is not None:
    google_tools = ""
    for line in frontmatter(google_seat).splitlines():
        if line.startswith("tools:"):
            google_tools = line
    if "mcp__plugin_ae_gemini__models" in google_tools:
        ok("the Google seat can list the models it is asked to pick between")
    else:
        bad("the Google seat is asked which model answered but cannot list the models",
            f"plugins/ae/agents/workflow/gemini-proxy.md: {google_tools.strip() or 'no tools: line'}")

    # The body tells this seat to fetch its backend tools by name when they arrive deferred. A
    # tool that is in the grant but absent from that fetch list is the one tool the seat would
    # not hold on the deferred path — the grant and the fetch list have to name the same set.
    granted = set(re.findall(r"mcp__plugin_ae_gemini__\w+", google_tools))
    fetch_lists = " ".join(re.findall(r"ToolSearch\(query: \"select:[^\"]*\"", google_seat))
    fetched = set(re.findall(r"mcp__plugin_ae_gemini__\w+", fetch_lists))
    if granted and granted <= fetched:
        ok("the Google seat's deferred-tool fetch names every backend tool it is granted")
    else:
        bad("the Google seat is granted a backend tool its own fetch list does not name",
            "plugins/ae/agents/workflow/gemini-proxy.md: granted but never fetched: "
            f"{sorted(granted - fetched) or '(none)'}")

# --- F-098 AC1: the composite is frozen, and something can tell that it was not ------------
#
# A composite was edited after all four close-out readers had attacked it, and the record then
# disagreed with every finding written against it. Nothing detected that. The rule needs a leg
# that writes the evidence down at the moment of the spawn, or it is a rule with no witness.

discuss = read("plugins/ae/skills/discuss/SKILL.md")
if discuss is not None:
    if "frozen" in discuss.lower() and "round-3/FROZEN" in discuss:
        ok("the discuss stage freezes the composite and records its digest at the spawn")
    else:
        bad("the discuss stage never freezes the composite",
            "plugins/ae/skills/discuss/SKILL.md: a composite that can change after the round "
            "that attacks it makes every finding cite a version that no longer exists")

print()
print(f"  {len(passed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
PY
