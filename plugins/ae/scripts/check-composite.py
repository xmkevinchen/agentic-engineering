#!/usr/bin/env python3
"""check-composite.py — run the mechanical falsifiers of F-098's AC1, AC3 and AC4 over a composite.

Usage: python3 plugins/ae/scripts/check-composite.py <path-to-composite.md>
Exit 0 = nothing found. Exit 1 = at least one violation, listed on stdout.

What it decides, and what it does not:

  AC4  every material point carries one of the four dispositions, and a `chosen` point cites
       something a reader can open. A material point is a list item at indent 0, outside code
       fences and block quotes, under a heading. Nested items belong to the point above them.
  AC1  when round-3/FROZEN sits beside the composite, its digest still matches. FROZEN is
       written when round three is spawned, so a mismatch means the artifact under attack is
       not the artifact of record.
  AC3  when a sibling round-3/ exists, at least one angle recorded that it held the seat-file
       paths. AC3 is unmet by default without that: a criterion nobody was equipped to check is
       unexamined, not satisfied.

  AC2 is absent on purpose. Its falsifier asks whether a seat's claim reached the composite with
  a stated reason. Nothing here decides that, and a word-presence check would report green on a
  composite that dropped a rebuttal — which is the failure AC2 exists to catch.
"""

import hashlib
import pathlib
import re
import sys

MARKS = ("survived", "dropped", "unresolved", "chosen")
LIST_ITEM = re.compile(r"^(?:[-*+]|\d+\.)\s+\S")
MARK_IN = re.compile(r"`(" + "|".join(MARKS) + r")`")
# something a reader can open: a path with an extension, optionally with a line cite
CITATION = re.compile(r"[\w./-]+\.\w+(?::\d+)?")


def material_points(text):
    """Yield (line_number, line) for each top-level list item outside fences and quotes."""
    body = re.sub(r"\A---\n.*?\n---\n", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    in_fence = False
    seen_heading = False
    for number, line in enumerate(body.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if line.startswith("#"):
            seen_heading = True
            continue
        if not seen_heading or line.startswith(">"):
            continue
        if LIST_ITEM.match(line):
            yield number, line


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
                        f"({'/'.join(MARKS)}): {line.strip()[:72]}")
    for number, line in points:
        found = MARK_IN.search(line)
        if found and found.group(1) == "chosen" and not CITATION.search(line):
            problems.append(f"{path}:{number}: `chosen` names no reason a reader can check: "
                            f"{line.strip()[:72]}")
    # --- AC1 -----------------------------------------------------------------------------
    frozen = path.parent.parent / "round-3" / "FROZEN"
    if frozen.is_file():
        recorded = frozen.read_text().split()[0] if frozen.read_text().split() else ""
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if recorded != actual:
            problems.append(f"{path}: content changed after round three was spawned — "
                            f"FROZEN records sha256 {recorded[:16]}…, file is {actual[:16]}…")

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
