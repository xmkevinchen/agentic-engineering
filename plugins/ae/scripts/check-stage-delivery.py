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
MARKER_FILE = {"analyze": "analysis.md"}

# `ended:` is present exactly when the stage ended without its full deliverable set, and its value
# names which ending. Every value below is an ending the stage's own skill already states.
ENDINGS = {"analyze": ("blocked", "nothing-to-do", "not-one-item")}

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


def check_ending(stage, marker_path, front, problems, missing):
    """The `ended:` contract, shared by every stage that has one.

    `missing` is the path of the deliverable the caller found absent, or None — observed on disk,
    never taken from what the directory says about itself. It is named rather than described
    because the message has to be enough to finish the missing part without running the stage
    again, and "the remaining deliverable" is not.
    """
    allowed = ENDINGS[stage]
    ended = front.get("ended")
    ended = None if isinstance(ended, dict) else ended

    if missing and not ended:
        problems.append(
            f"{stage}: {missing}: absent, and {marker_path} carries no `ended:` — a legitimate "
            f"ending writes `ended: {' | '.join(allowed)}` there, so without one this directory "
            f"is indistinguishable from a run that stopped halfway")
    elif ended and ended not in allowed:
        problems.append(
            f"{stage}: {marker_path}: `ended: {ended}` is not an ending this stage has — "
            f"expected one of {' | '.join(allowed)}")
    elif ended and not missing:
        problems.append(
            f"{stage}: {marker_path}: carries `ended: {ended}` while the full deliverable set is "
            f"on disk — `ended:` marks a stage that ended short, so one of the two is wrong")


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
    check_ending("analyze", analysis_path, front, problems,
                 missing=None if acceptance_path.is_file() else acceptance_path)

    # `ended:` says which ending; `blocked_by:` carries that ending's detail. They can disagree,
    # and the disagreement is the report — preferring one would decide which is true, and this
    # script has no way to know.
    blocked_by = front.get("blocked_by") or {}
    ended = front.get("ended")
    ended = None if isinstance(ended, dict) else ended
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


CHECKERS = {"analyze": check_analyze}

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
