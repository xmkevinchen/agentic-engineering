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

  DISCUSS  every id in the analysis's `discuss:` list has a `decision-<id>.md` settling it or a
           `returned-<id>.md` sending it back. There is no `ended:` here: the filename already
           carries the control flow, which is why the name is fixed.

  PLAN     `plan.md` exists, and its `ended:` — where it has one — names an ending PLAN has.
  WORK     the same, for `log.md`.
  REVIEW   the same, for `review.md`.

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


def check_plan(directory, problems):
    check_single_deliverable("plan", directory, problems)


def check_work(directory, problems):
    check_single_deliverable("work", directory, problems)


def check_review(directory, problems):
    check_single_deliverable("review", directory, problems)


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
