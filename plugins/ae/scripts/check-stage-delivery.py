#!/usr/bin/env python3
"""check-stage-delivery.py — read a feature directory off disk and say what a stage did not deliver.

Usage: python3 plugins/ae/scripts/check-stage-delivery.py <feature-dir> <stage>
       <stage> is one of: analyze, discuss, plan, work, review
Exit 0 = nothing found. Exit 1 = at least one problem, listed on stdout.

Its whole input is the directory and the stage name. It never reads a conversation, a log's
claim, or an agent's report of what it wrote — which is what makes "the deliverable is there"
a fact about the filesystem rather than a thing the author of the deliverable asserts.

What it decides:

  ANALYZE  `analysis.md` exists; and where `acceptance.md` does not, `analysis.md` carries an
           `ended:` naming which of the three legitimate endings this was. Without that marker a
           finished-and-closed directory and a run that stopped halfway are the same on disk.
           `ended:` and `blocked_by:` are allowed to disagree, and the disagreement is reported
           rather than silently resolved: one says which ending, the other carries its detail.
           Beyond existence: the feature id is one no other directory in the same features root
           holds, and every criterion carries a falsifier or a judgement mark. A criterion
           written with no id at all is invisible here — real acceptance files open ordinary
           paragraphs with bold text, so "a bold line is a criterion" would invent findings, and
           there is no other structure to read. That gap is a job for the fresh eyes.

  DISCUSS  every id in the analysis's `discuss:` list has a `decision-<id>.md` settling it or a
           `returned-<id>.md` sending it back. There is no `ended:` here: the filename already
           carries the control flow, which is why the name is fixed.

  PLAN     `plan.md` exists, its `ended:` — where it has one — names an ending PLAN has, and
           every signed criterion is cited in it. `ended: input-refused` is exempt from the
           citation rule: nothing was planned, which is the point of that ending.
  WORK     the same, for `log.md`.
  REVIEW   the same, for `review.md`, plus a verdict in the frontmatter or the first few lines.

What it does not decide, at any exit code: whether an answer rests on evidence, whether a
criterion means what its words say, whether a check named in a plan would actually turn red, or
whether a verdict was reached honestly. Those are judgements, and a word-presence check that
reported on them would be the author's own account of the work arriving by another route. They
stay with the fresh eyes and the human gates. Exit 0 means "no mechanical violation found", not
"the stage conformed".
"""

import pathlib
import re
import sys

STAGES = ("analyze", "discuss", "plan", "work", "review")

# the file each stage writes its ending marker into — whichever deliverable it did write
MARKER_FILE = {"analyze": "analysis.md", "plan": "plan.md", "work": "log.md",
               "review": "review.md"}

# `ended:` is present when the stage ended without its full deliverable set, and its value names
# which ending. Every value below is an ending the stage's own skill already states.
ENDINGS = {
    "analyze": ("blocked", "nothing-to-do", "not-one-item"),
    "plan": ("criterion-unplannable", "check-green-first", "input-refused"),
    "work": ("blocked", "criterion-defective"),
    "review": ("blocked",),
}

STATE_DIRS = ("active", "paused", "done", "abandoned")
FEATURE_ID = re.compile(r"^(F-\d+)-")
# A criterion opens a block: the id at the start of a line, bold or not, then the dash that
# separates it from the property, and the block runs to the next one. The dash is what keeps
# ordinary prose out — "AC2 and AC4 are not omitted" and "AC1 and AC2 both passing does not"
# both open lines in real acceptance files, and matching the bare id reported those as criteria
# carrying no falsifier. A criterion written with no id at all is invisible here; see the
# docstring.
CRITERION = re.compile(r"^\*{0,2}(AC\d+)\s*[\u2014\u2013]\s")
# either of the two things `analyze/SKILL.md` says a criterion must carry
FALSIFIER_OR_JUDGEMENT = re.compile(r"falsifi|judgement|judgment", re.I)

# an id mentioned anywhere in a deliverable, which is all "accounted for" can mean mechanically
CRITERION_MENTION = r"\b{}\b"
# A verdict is readable without reading the body when it is in the frontmatter or right at the
# top. PASS and FAIL are matched in upper case only: these files write "pass 3" and "pass 1"
# throughout their prose to mean a round of the loop, and a case-insensitive match reported a
# verdict in a review that had none left in it at all.
VERDICT_HEAD_LINES = 12
VERDICT_IN_BODY = re.compile(r"(?i:\bverdict\b)|(?<![\w-])(?:PASS|FAIL)(?![\w-])")

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\s*?\n", re.S)
TOP_KEY = re.compile(r"^([A-Za-z_][\w-]*):[ \t]*(.*)$")
NESTED_KEY = re.compile(r"^[ \t]+([A-Za-z_][\w-]*):[ \t]*(.*)$")
EMPTY_VALUES = ("", "{}", "[]", "null", "~")


def frontmatter(text):
    """Parse the leading `---` block into {key: str} and {key: {id: str}}. No yaml in stdlib."""
    found = FRONTMATTER.match(text)
    if not found:
        return {}
    data, key = {}, None
    for line in found.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        top = TOP_KEY.match(line)
        if top:
            key, value = top.group(1), top.group(2).strip()
            data[key] = {} if value in EMPTY_VALUES else value
            continue
        nested = NESTED_KEY.match(line)
        if nested and key is not None and isinstance(data.get(key), dict):
            data[key][nested.group(1)] = nested.group(2).strip()
    return data


def criterion_blocks(text):
    """Yield (id, block) for each criterion in an acceptance file, in file order."""
    blocks, current = [], None
    for line in text.splitlines():
        found = CRITERION.match(line)
        if found:
            current = [found.group(1), [line]]
            blocks.append(current)
        elif current:
            current[1].append(line)
    return [(cid, "\n".join(lines)) for cid, lines in blocks]


def read(path):
    return path.read_text() if path.is_file() else None


def ending_value(stage, marker_path, front, problems):
    """Return the `ended:` value, reporting one that is not an ending this stage has."""
    ended = front.get("ended")
    ended = None if isinstance(ended, dict) else ended
    if ended and ended not in ENDINGS[stage]:
        problems.append(
            f"{stage}: {marker_path}: `ended: {ended}` is not an ending this stage has — "
            f"expected one of {' | '.join(ENDINGS[stage])}")
        return None
    return ended


def report_absent(stage, missing, problems):
    """A deliverable that is not on disk, and nothing on disk saying why.

    The missing file is named rather than described: the message has to be enough to finish the
    missing part without running the stage again, and "the remaining deliverable" is not.
    """
    problems.append(
        f"{stage}: {missing}: absent, and nothing in this directory carries an `ended:` saying "
        f"why — a legitimate ending writes `ended: {' | '.join(ENDINGS[stage])}` into the "
        f"deliverable it did get as far as writing, so without one this directory is "
        f"indistinguishable from a run that stopped halfway")


def check_single_deliverable(stage, directory, problems):
    """PLAN, WORK and REVIEW each write one file, and it carries its own `ended:`.

    ANALYZE is the odd one out: its two files mean the marker lives in the file that survives
    while the other is absent. Here the marker and the deliverable are the same file, so an
    absent deliverable is an absent marker, and there is nowhere for the two to disagree.
    """
    path = directory / MARKER_FILE[stage]
    text = read(path)
    if text is None:
        report_absent(stage, path, problems)
        return None
    return ending_value(stage, path, frontmatter(text), problems)


def check_analyze(directory, problems):
    analysis_path = directory / "analysis.md"
    acceptance_path = directory / "acceptance.md"
    analysis = read(analysis_path)

    if analysis is None:
        problems.append(
            f"analyze: {analysis_path}: absent — the stage's own record of the problem is not on "
            f"disk, so nothing here says the stage ran at all")
        return

    front = frontmatter(analysis)
    ended = ending_value("analyze", analysis_path, front, problems)

    # ANALYZE alone pairs the marker against a second file: `ended:` is present exactly when
    # `acceptance.md` is not, so each direction of the mismatch is its own report.
    if not acceptance_path.is_file() and not ended:
        report_absent("analyze", acceptance_path, problems)
    elif ended and acceptance_path.is_file():
        problems.append(
            f"analyze: {analysis_path}: carries `ended: {ended}` while {acceptance_path} is on "
            f"disk — `ended:` marks a stage that stopped short, so one of the two is wrong")

    # `ended:` says which ending; `blocked_by:` carries that ending's detail. They can disagree,
    # and the disagreement is the report — preferring one would decide which is true, and this
    # script has no way to know.
    blocked_by = front.get("blocked_by") or {}
    if ended == "blocked" and not blocked_by:
        problems.append(
            f"analyze: {analysis_path}: `ended: blocked` with an empty `blocked_by:` — the "
            f"ending says it is waiting on the human and nothing says what for")
    check_feature_id(directory, problems)
    check_criteria(directory, problems)

    if blocked_by and ended != "blocked":
        marker = f"`ended: {ended}`" if ended else "no `ended:`"
        problems.append(
            f"analyze: {analysis_path}: `blocked_by:` holds {', '.join(sorted(blocked_by))} "
            f"while the file carries {marker} — a blocked analysis is mid-loop, not ended some "
            f"other way")


def check_discuss(directory, problems):
    """The ids in the analysis minus the files on disk are the questions still outstanding.

    A question is answered by `decision-<id>.md` or sent back by `returned-<id>.md`; either one
    is a file, and an id with neither is a run that produced nothing where the analysis said one
    was owed. There is no `ended:` here — the filename already carries the control flow.
    """
    analysis_path = directory / "analysis.md"
    analysis = read(analysis_path)
    if analysis is None:
        problems.append(
            f"discuss: {analysis_path}: absent — the ids this stage owes a record for are read "
            f"from its `discuss:` list, and there is no list")
        return

    discuss = frontmatter(analysis).get("discuss")
    if discuss is None:
        problems.append(
            f"discuss: {analysis_path}: no `discuss:` field — an empty list is a judgement with "
            f"a reason behind it and is written `discuss: {{}}`; a missing one says nothing")
        return
    if not isinstance(discuss, dict):
        problems.append(
            f"discuss: {analysis_path}: `discuss:` is not a list of ids — nothing can tell which "
            f"questions were named, so nothing can tell which are still outstanding")
        return

    for question in sorted(discuss):
        if (directory / f"decision-{question}.md").is_file():
            continue
        if (directory / f"returned-{question}.md").is_file():
            continue
        problems.append(
            f"discuss: {directory / f'decision-{question}.md'}: absent — the analysis names "
            f"`{question}` and nothing on disk settles it or sends it back "
            f"(`returned-{question}.md`)")


def check_criterion_coverage(stage, directory, problems):
    """Every signed criterion is accounted for somewhere in the stage's deliverable.

    Mentioning an id is all this can decide. Whether the account is any good — whether a step's
    check would really turn red, whether a verdict rests on evidence — is not a thing a search
    can answer, and reporting green on it would be the author's own account arriving by another
    route. What it does catch is the criterion that is simply not there, which is the condition
    `go/SKILL.md` already tells the session agent to send each of these back for.
    """
    acceptance = read(directory / "acceptance.md")
    if acceptance is None:
        problems.append(
            f"{stage}: {directory / 'acceptance.md'}: absent — nothing says which criteria this "
            f"stage owes an account of, so its coverage is unchecked rather than confirmed")
        return

    path = directory / MARKER_FILE[stage]
    deliverable = read(path)
    if deliverable is None:
        return

    for cid, _ in criterion_blocks(acceptance):
        if not re.search(CRITERION_MENTION.format(cid), deliverable):
            problems.append(
                f"{stage}: {path}: never mentions {cid} — the human signed it and this "
                f"deliverable leaves it unaccounted for")


def check_plan(directory, problems):
    ended = check_single_deliverable("plan", directory, problems)
    # `input-refused` is the one ending where nothing was planned at all: the criteria were sent
    # back before any of them could be cited, so demanding citations would report a stage that
    # obeyed its own refusal rule as if it had skipped work.
    if ended != "input-refused":
        check_criterion_coverage("plan", directory, problems)


def check_work(directory, problems):
    check_single_deliverable("work", directory, problems)
    check_criterion_coverage("work", directory, problems)


def check_review(directory, problems):
    check_single_deliverable("review", directory, problems)
    check_criterion_coverage("review", directory, problems)

    path = directory / "review.md"
    text = read(path)
    if text is None:
        return
    front = frontmatter(text)
    if isinstance(front.get("verdict"), str):
        return
    body = FRONTMATTER.sub("", text)
    head = [line for line in body.splitlines() if line.strip()][:VERDICT_HEAD_LINES]
    if not any(VERDICT_IN_BODY.search(line) for line in head):
        problems.append(
            f"review: {path}: no verdict in the frontmatter and none in its first "
            f"{VERDICT_HEAD_LINES} lines — the human signs from this file, and a verdict they "
            f"have to read the body to find is not readable without reading the body")


def check_feature_id(directory, problems):
    """`F-NNN` is an id no feature has ever held, and retired ids are never reused.

    Scanned across the four state directories of this feature's own features root, because that
    is where every id this project has allocated lives. Observed failing in the other direction
    once already: a directory was written as `F-001` while `F-089` was the high-water mark, and
    the only thing that noticed was a person listing the directory for an unrelated reason.
    """
    if directory.parent.name not in STATE_DIRS:
        problems.append(
            f"analyze: {directory}: does not sit under one of "
            f"{', '.join(STATE_DIRS)}/, so nothing can tell which ids are already allocated and "
            f"the uniqueness of this one is unchecked rather than confirmed")
        return
    found = FEATURE_ID.match(directory.name)
    if not found:
        problems.append(
            f"analyze: {directory}: is not named `F-NNN-<slug>`, so it carries no id for a later "
            f"stage to cite and none for this check to compare")
        return

    root = directory.parent.parent
    holders = sorted(str(p) for state in STATE_DIRS
                     for p in root.joinpath(state).glob(f"{found.group(1)}-*") if p.is_dir())
    if len(holders) > 1:
        problems.append(
            f"analyze: {directory}: the id {found.group(1)} is held by {len(holders)} "
            f"directories — {', '.join(holders)} — and a citation of that id now resolves to "
            f"more than one feature")


def check_criteria(directory, problems):
    """Every criterion carries an id later stages cite, and a falsifier or a judgement mark."""
    path = directory / "acceptance.md"
    text = read(path)
    if text is None:
        return

    blocks = criterion_blocks(text)
    if not blocks:
        problems.append(
            f"analyze: {path}: holds no criterion id — later stages cite criteria by id and "
            f"nobody copies them, so there is nothing here for a plan, a log or a review to name")
        return

    for cid, block in blocks:
        if not FALSIFIER_OR_JUDGEMENT.search(block):
            problems.append(
                f"analyze: {path}: {cid} states no falsifier and is not marked judgement — "
                f"nobody can be held to it, and nothing says what would count as failing it")


CHECKERS = {"analyze": check_analyze, "discuss": check_discuss, "plan": check_plan,
            "work": check_work, "review": check_review}

COVERAGE = """Not decided here: whether an answer rests on evidence, whether a criterion means what
its words say, whether a check named in a plan would actually turn red, or whether a verdict was
reached honestly. Exit 0 is "no mechanical violation found", not "the stage conformed"."""


def main(argv):
    if len(argv) != 3 or argv[2] not in STAGES:
        print(f"usage: {argv[0]} <feature-dir> <{'|'.join(STAGES)}>", file=sys.stderr)
        return 2

    directory, stage = pathlib.Path(argv[1]), argv[2]
    if not directory.is_dir():
        print(f"{stage}: {directory}: no such feature directory")
        return 1

    problems = []
    checker = CHECKERS.get(stage)
    if checker:
        checker(directory, problems)

    for problem in problems:
        print(problem)
    if problems:
        print(f"\n{len(problems)} problem(s)")
        return 1
    print(f"{directory} ({stage}): nothing found.\n{COVERAGE}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
