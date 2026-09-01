#!/usr/bin/env python3
"""check-composite.py — run the mechanical falsifiers of F-098's AC1, AC3 and AC4 over a composite.

Usage: python3 plugins/ae/scripts/check-composite.py <path-to-composite.md>
Exit 0 = nothing found. Exit 1 = at least one violation, listed on stdout.

What it decides, and what it does not:

  AC4  every material point carries one of the four dispositions, and a `chosen` point cites
       something a reader can open. A material point is a list item at indent 0, outside code
       fences and block quotes, under a heading. Nested items belong to the point above them.
  AC1  a spawned round three owes a digest, and it still matches. FROZEN is written when round
       three is spawned, so a mismatch means the artifact under attack is not the artifact of
       record — and a missing FROZEN means nothing can tell either way, which is unmet rather
       than passed.
  AC3  every `survived` or `dropped` point cites a source a reader can open, and at least one
       angle recorded that it held the seat-file paths. AC3 is unmet by default without the
       latter: a criterion nobody was equipped to check is unexamined, not satisfied.

  It also reports a seat file that never says which agent held it, a bare round-N/ with no pass-N/ wrapper, and a seat file named what the host
  loads as instructions, which is not one of the
  four criteria but breaks the property round one exists to buy.

  AC2 is absent on purpose. Its falsifier asks whether a seat's claim reached the composite with
  a stated reason. Nothing here decides that, and a word-presence check would report green on a
  composite that dropped a rebuttal — which is the failure AC2 exists to catch.
"""

import hashlib
import pathlib
import re
import sys

MARKS = ("survived", "dropped", "unresolved", "chosen")
# names a coding host reads as directory-scoped instructions rather than as data
HOST_INSTRUCTION_FILES = {"claude.md", "agents.md", "gemini.md"}
LIST_ITEM = re.compile(r"^(?:[-*+]|\d+\.)\s+\S")
MARK_IN = re.compile(r"`(" + "|".join(MARKS) + r")`")
# something a reader can open: a path with an extension, optionally with a line cite
CITATION = re.compile(r"[\w./-]+\.\w+(?::\d+)?")


def material_points(text):
    """Yield (line_number, whole_item) for each top-level list item outside fences and quotes.

    An item is its opening line plus every continuation line under it — a wrapped sentence, an
    indented sub-point, a quoted line. A point's mark and its citation land wherever the prose
    put them, and a check that read only the opening line would report a violation against a
    composite that obeys the rule. Observed doing exactly that before this was fixed.
    """
    body = re.sub(r"\A---\n.*?\n---\n", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    in_fence = False
    seen_heading = False
    start, collected = None, []

    def flush():
        if start is not None:
            return [(start, "\n".join(collected))]
        return []

    for number, line in enumerate(body.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            yield from flush()
            start, collected = None, []
            continue
        if in_fence:
            continue
        if line.startswith("#"):
            yield from flush()
            start, collected = None, []
            seen_heading = True
            continue
        if not seen_heading:
            continue
        if LIST_ITEM.match(line):
            yield from flush()
            start, collected = number, [line]
            continue
        if start is not None:
            # a continuation belongs to the item above it; an unindented run of prose ends it
            if line.strip() == "" or line.startswith((" ", "\t", ">")):
                collected.append(line)
            else:
                yield from flush()
                start, collected = None, []
    yield from flush()


def check(path):
    path = pathlib.Path(path)
    if not path.is_file():
        return [f"{path}: no such file"]

    text = path.read_text()
    problems = []

    # --- AC4 -----------------------------------------------------------------------------
    points = list(material_points(text))
    unmarked = [(n, l) for n, l in points if not MARK_IN.search(l)]
    for number, line in unmarked:
        problems.append(f"{path}:{number}: material point carries no mark "
                        f"({'/'.join(MARKS)}): {line.strip().splitlines()[0][:72]}")
    for number, line in points:
        found = MARK_IN.search(line)
        if not found:
            continue
        mark = found.group(1)
        # `survived` and `dropped` characterise what a seat said, so each owes the file that said
        # it. `chosen` owes a reason someone else can check. `unresolved` owes neither: a question
        # nobody raised has no seat file to point at.
        if mark in ("survived", "dropped") and not CITATION.search(line):
            problems.append(f"{path}:{number}: `{mark}` cites no source a reader can open: "
                            f"{line.strip().splitlines()[0][:72]}")
        if mark == "chosen" and not CITATION.search(line):
            problems.append(f"{path}:{number}: `chosen` names no reason a reader can check: "
                            f"{line.strip().splitlines()[0][:72]}")
    # --- AC1 -----------------------------------------------------------------------------
    frozen = path.parent.parent / "round-3" / "FROZEN"
    round_three_dir = path.parent.parent / "round-3"
    if round_three_dir.is_dir() and not frozen.is_file():
        problems.append(f"{path}: round three was spawned and no FROZEN records the digest — "
                        f"a freeze nobody wrote down cannot be checked, so AC1 is unmet by "
                        f"default rather than passed")
    if frozen.is_file():
        recorded = frozen.read_text().split()[0] if frozen.read_text().split() else ""
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if recorded != actual:
            problems.append(f"{path}: content changed after round three was spawned — "
                            f"FROZEN records sha256 {recorded[:16]}…, file is {actual[:16]}…")

    # --- a seat says what held it ------------------------------------------------------------
    # An answer's weight depends on what produced it, and a seat cannot see its own agent type, so
    # the caller writes it. The skill has required this for two features and it was written down in
    # neither — while a liveness assertion for the rule stayed green the whole time, because it
    # checks that the skill still says it, not that anyone did it.
    for round_dir in ("round-1", "round-2"):
        for seat in sorted((path.parent.parent / round_dir).glob("*.md")):
            if seat.name in ("composite.md", "MAPPING.md"):
                continue
            head = seat.read_text()[:1200]
            missing = [k for k in ("agent:", "grant:") if f"\n{k}" not in head]
            if missing:
                problems.append(f"{seat}: never says what held the seat "
                                f"({', '.join(m.rstrip(':') for m in missing)} absent) — an "
                                f"answer's weight depends on what produced it, and a seat cannot "
                                f"see its own agent type")

    # --- the pass is countable -------------------------------------------------------------
    # The loop's two-pass bound is counted off completed pass-N/ directories on disk. A bare
    # round-N/ with no pass-N/ wrapper leaves a directory whose passes cannot be counted, so the
    # bound cannot fire — and that bound is the only thing ending a loop that re-enters itself
    # with no human in the path.
    if path.parent.parent.name and not path.parent.parent.name.startswith("pass-"):
        problems.append(f"{path}: sits under '{path.parent.parent.name}/', not a pass-N/ — a bare "
                        f"round-N/ leaves a directory whose passes cannot be counted, and the "
                        f"loop's bound is counted from exactly there")

    # --- the blind round stays blind -------------------------------------------------------
    # A seat file named what the host reads as instructions is loaded into every later agent whose
    # work reaches that directory, as a directive it cannot decline. The seat's answer then travels
    # as an instruction and round one is no longer blind. Measured on this filesystem: `claude.md`
    # and `CLAUDE.md` return one inode.
    for stray in sorted(path.parent.parent.rglob("*.md")):
        if stray.name.lower() in HOST_INSTRUCTION_FILES:
            problems.append(f"{stray}: named what the host loads as instructions — this seat's "
                            f"answer reaches later agents as a directive they cannot decline, and "
                            f"the blind round is no longer blind")

    # --- AC3 -----------------------------------------------------------------------------
    round_three = path.parent.parent / "round-3"
    if round_three.is_dir():
        angles = sorted(p for p in round_three.glob("*.md"))
        witnessed = [p for p in angles
                     if re.search(r"^given_seat_file_paths:\s*true\s*$", p.read_text(), re.M)]
        if angles and not witnessed:
            problems.append(f"{path}: no close-out angle records given_seat_file_paths: true — "
                            f"AC3 is unmet by default, not passed")

    return problems


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip().splitlines()[2], file=sys.stderr)
        return 2
    problems = check(sys.argv[1])
    for problem in problems:
        print(problem)
    if problems:
        print(f"\n{len(problems)} violation(s)")
        return 1
    print(f"{sys.argv[1]}: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
